/**
 * Permissions / RBAC core (M21-1, S345/S346/S348/S349/S355).
 *
 * Модель: OWNER/ADMIN = management-tier → FULL bypass на сущности (правка GPT Q1).
 * MEMBER → доступ решает ACL: 4 уровня NONE<READ<READ_WRITE<FULL, области Workspace/Team/Individual,
 * «точнее перекрывает шире» (Individual > Team > Workspace; entity-specific > kind-default).
 * Системный fallback после всех lookup = NONE (правка #2, без скрытого READ_WRITE).
 * FULL на сущность = управление сущностью + её правами, но НЕ billing/security/members (правка #3).
 *
 * M21-1: WORKSPACE + INDIVIDUAL(user). TEAM-гранты подключатся в M21-2 (subjectKey 'team:<id>' уже заложен).
 */
import { AccessLevel, EntityKind, PermissionScope, Prisma, PrismaClient } from '@prisma/client';
import type { Request, Response } from 'express';
import { audit } from './audit';

const prisma = new PrismaClient();

export const LEVEL_ORDER: Record<AccessLevel, number> = { NONE: 0, READ: 1, READ_WRITE: 2, FULL: 3 };
export function meets(have: AccessLevel, needed: AccessLevel): boolean { return LEVEL_ORDER[have] >= LEVEL_ORDER[needed]; }
export function isManager(role?: string | null): boolean { return role === 'OWNER' || role === 'ADMIN'; }

export const WS_SUBJECT = 'workspace';
export const userSubject = (userId: string) => `user:${userId}`;
export const teamSubject = (teamId: string) => `team:${teamId}`;
export const ALL_ENTITY_KINDS: EntityKind[] = ['OBJECT', 'LIST', 'DASHBOARD', 'WORKFLOW', 'SEQUENCE'];

// Workspace-дефолты: текущий UX сохраняем (READ_WRITE), кроме DASHBOARD = NONE (приватны создателю, правка #4).
// Сохраняем текущий UX: записи/списки члены правят (READ_WRITE); workflows/sequences были read-only
// для MEMBER (requireManager на запись) → READ; dashboards приватны создателю → NONE (правка #4).
const WS_DEFAULTS: { kind: EntityKind; level: AccessLevel }[] = [
  { kind: 'OBJECT', level: 'READ_WRITE' },
  { kind: 'LIST', level: 'READ_WRITE' },
  { kind: 'WORKFLOW', level: 'READ' },
  { kind: 'SEQUENCE', level: 'READ_WRITE' },
  { kind: 'DASHBOARD', level: 'NONE' },
];

// Ленивый идемпотентный seed дефолтов на org (per-process кэш; createMany skipDuplicates безопасен к гонке).
const seededOrgs = new Set<string>();
export async function ensurePermissionDefaults(orgId: string): Promise<void> {
  if (seededOrgs.has(orgId)) return;
  await prisma.permissionGrant.createMany({
    data: WS_DEFAULTS.map((d) => ({ orgId, scope: 'WORKSPACE' as PermissionScope, subjectKey: WS_SUBJECT, entityKind: d.kind, entityKey: '*', level: d.level })),
    skipDuplicates: true,
  });
  // существующие dashboards/reports → creator INDIVIDUAL FULL (приватность создателю сохранена, правка #4)
  const [dashboards, reports] = await Promise.all([
    prisma.dashboard.findMany({ where: { orgId, createdById: { not: null } }, select: { id: true, createdById: true } }),
    prisma.report.findMany({ where: { orgId, createdById: { not: null } }, select: { id: true, createdById: true } }),
  ]);
  const grants = [...dashboards, ...reports].filter((d) => d.createdById).map((d) => ({ orgId, scope: 'INDIVIDUAL' as PermissionScope, subjectKey: userSubject(d.createdById!), entityKind: 'DASHBOARD' as EntityKind, entityKey: d.id, level: 'FULL' as AccessLevel }));
  if (grants.length) await prisma.permissionGrant.createMany({ data: grants, skipDuplicates: true });
  // M21-2 (S352): существующие воркфлоу сохраняют возможность мутировать (READ_WRITE на OBJECT/LIST) —
  // иначе все текущие автоматизации сломались бы default-deny. Новые воркфлоу гранта НЕ получают (explicit-only).
  const workflows = await prisma.workflow.findMany({ where: { orgId }, select: { id: true } });
  const autoGrants = workflows.flatMap((w) => (['OBJECT', 'LIST'] as EntityKind[]).map((k) => ({ orgId, workflowId: w.id, entityKind: k, entityKey: '*', level: 'READ_WRITE' as AccessLevel })));
  if (autoGrants.length) await prisma.automationGrant.createMany({ data: autoGrants, skipDuplicates: true });
  seededOrgs.add(orgId);
}

export type AccessResolver = (entityId?: string | null) => AccessLevel;

// Резолвер доступа (org, user, kind): гранты Workspace/Team/Individual → функция (entityId|null) → AccessLevel.
// Precedence (M21-2): Individual > Team(max) > Workspace; entity-specific > kind-default; Individual NONE бьёт Team FULL.
// Expert group (Team.isExternal): пользователь НЕ наследует workspace-дефолты (только individual+team, иначе NONE).
export async function buildResolver(orgId: string, user: { userId: string; role?: string | null }, kind: EntityKind): Promise<AccessResolver> {
  if (isManager(user.role)) return () => 'FULL';
  await ensurePermissionDefaults(orgId);
  const teams = await prisma.teamMember.findMany({ where: { orgId, userId: user.userId }, select: { teamId: true, team: { select: { isExternal: true } } } });
  const isExternalUser = teams.some((t) => t.team.isExternal);
  const subjectKeys = [WS_SUBJECT, userSubject(user.userId), ...teams.map((t) => teamSubject(t.teamId))];
  const grants = await prisma.permissionGrant.findMany({ where: { orgId, entityKind: kind, subjectKey: { in: subjectKeys } }, select: { scope: true, entityKey: true, level: true } });
  const indiv = new Map<string, AccessLevel>();
  const ws = new Map<string, AccessLevel>();
  const team = new Map<string, AccessLevel>(); // entityKey → МАКС уровень среди team-грантов
  for (const g of grants) {
    if (g.scope === 'INDIVIDUAL') indiv.set(g.entityKey, g.level);
    else if (g.scope === 'WORKSPACE') ws.set(g.entityKey, g.level);
    else if (g.scope === 'TEAM') {
      const cur = team.get(g.entityKey);
      if (cur == null || LEVEL_ORDER[g.level] > LEVEL_ORDER[cur]) team.set(g.entityKey, g.level); // multi-team = max
    }
  }
  return (entityId?: string | null) => {
    const id = entityId ?? '*';
    // Individual (любой) перекрывает Team; Team перекрывает Workspace; entity-specific > kind-default
    if (id !== '*' && indiv.has(id)) return indiv.get(id)!;
    if (indiv.has('*')) return indiv.get('*')!;
    if (id !== '*' && team.has(id)) return team.get(id)!;
    if (team.has('*')) return team.get('*')!;
    if (!isExternalUser) { // expert не наследует workspace-дефолты
      if (id !== '*' && ws.has(id)) return ws.get(id)!;
      if (ws.has('*')) return ws.get('*')!;
    }
    return 'NONE';
  };
}

// Automation-доступ (S352): доступ ВОРКФЛОУ к сущности из его AutomationGrant (default NONE — нужен явный грант).
export async function automationAccess(orgId: string, workflowId: string, kind: EntityKind, entityId?: string | null): Promise<AccessLevel> {
  const grants = await prisma.automationGrant.findMany({ where: { orgId, workflowId, entityKind: kind }, select: { entityKey: true, level: true } });
  const m = new Map(grants.map((g) => [g.entityKey, g.level]));
  const id = entityId ?? '*';
  if (id !== '*' && m.has(id)) return m.get(id)!;
  if (m.has('*')) return m.get('*')!;
  return 'NONE';
}

export async function resolveAccess(orgId: string, user: { userId: string; role?: string | null }, kind: EntityKind, entityId?: string | null): Promise<AccessLevel> {
  const r = await buildResolver(orgId, user, kind);
  return r(entityId);
}

// Гард для роутов: true если доступ есть, иначе 403 PERMISSION_DENIED. Управляющие роли — FULL bypass.
export async function assertAccess(req: Request, res: Response, kind: EntityKind, needed: AccessLevel, entityId?: string | null): Promise<boolean> {
  const have = await resolveAccess(req.user!.orgId!, { userId: req.user!.userId, role: req.user!.role }, kind, entityId);
  if (!meets(have, needed)) {
    res.status(403).json({ error: `You don't have ${needed.replace('_', '+').toLowerCase()} access to this ${kind.toLowerCase()}`, code: 'PERMISSION_DENIED', entityKind: kind, needed, have });
    return false;
  }
  return true;
}

// Dashboard-creator default (правка #4): новый dashboard/report → creator INDIVIDUAL FULL (workspace default = NONE).
export async function grantCreatorFull(orgId: string, userId: string, kind: EntityKind, entityId: string): Promise<void> {
  await prisma.permissionGrant.upsert({
    where: { orgId_scope_subjectKey_entityKind_entityKey: { orgId, scope: 'INDIVIDUAL', subjectKey: userSubject(userId), entityKind: kind, entityKey: entityId } },
    create: { orgId, scope: 'INDIVIDUAL', subjectKey: userSubject(userId), entityKind: kind, entityKey: entityId, level: 'FULL', updatedById: userId },
    update: { level: 'FULL', updatedById: userId },
  });
}

// ── Управление грантами (admin-only вызывается из routes/permissions.ts) ──
export async function setGrant(orgId: string, actorId: string, g: { scope: PermissionScope; subjectKey: string; entityKind: EntityKind; entityKey: string; level: AccessLevel }): Promise<void> {
  await prisma.permissionGrant.upsert({
    where: { orgId_scope_subjectKey_entityKind_entityKey: { orgId, scope: g.scope, subjectKey: g.subjectKey, entityKind: g.entityKind, entityKey: g.entityKey } },
    create: { orgId, ...g, updatedById: actorId },
    update: { level: g.level, updatedById: actorId },
  });
  await audit({ orgId, actorId, action: 'PERMISSION_GRANT_SET', targetType: 'permission', targetId: `${g.scope}:${g.subjectKey}:${g.entityKind}:${g.entityKey}`, summary: `${g.scope} ${g.subjectKey} · ${g.entityKind} ${g.entityKey} → ${g.level}` });
}

// очистить override (вернуть к наследуемому уровню). Workspace kind-default ('*') очищать нельзя — он базовый.
export async function clearGrant(orgId: string, actorId: string, g: { scope: PermissionScope; subjectKey: string; entityKind: EntityKind; entityKey: string }): Promise<void> {
  await prisma.permissionGrant.deleteMany({ where: { orgId, scope: g.scope, subjectKey: g.subjectKey, entityKind: g.entityKind, entityKey: g.entityKey } });
  await audit({ orgId, actorId, action: 'PERMISSION_GRANT_CLEARED', targetType: 'permission', targetId: `${g.scope}:${g.subjectKey}:${g.entityKind}:${g.entityKey}`, summary: `cleared ${g.scope} ${g.subjectKey} · ${g.entityKind} ${g.entityKey}` });
}

export async function listGrants(orgId: string): Promise<{ scope: PermissionScope; subjectKey: string; entityKind: EntityKind; entityKey: string; level: AccessLevel }[]> {
  await ensurePermissionDefaults(orgId);
  return prisma.permissionGrant.findMany({ where: { orgId }, select: { scope: true, subjectKey: true, entityKind: true, entityKey: true, level: true }, orderBy: [{ entityKind: 'asc' }, { scope: 'asc' }] });
}

// ── Automation grants (S352) ──
export async function setAutomationGrant(orgId: string, actorId: string, g: { workflowId: string; entityKind: EntityKind; entityKey: string; level: AccessLevel }): Promise<void> {
  await prisma.automationGrant.upsert({
    where: { orgId_workflowId_entityKind_entityKey: { orgId, workflowId: g.workflowId, entityKind: g.entityKind, entityKey: g.entityKey } },
    create: { orgId, ...g, updatedById: actorId },
    update: { level: g.level, updatedById: actorId },
  });
  await audit({ orgId, actorId, action: 'AUTOMATION_GRANT_SET', targetType: 'workflow', targetId: g.workflowId, summary: `${g.entityKind} ${g.entityKey} → ${g.level}` });
}
export async function clearAutomationGrant(orgId: string, actorId: string, g: { workflowId: string; entityKind: EntityKind; entityKey: string }): Promise<void> {
  await prisma.automationGrant.deleteMany({ where: { orgId, workflowId: g.workflowId, entityKind: g.entityKind, entityKey: g.entityKey } });
  await audit({ orgId, actorId, action: 'AUTOMATION_GRANT_CLEARED', targetType: 'workflow', targetId: g.workflowId, summary: `cleared ${g.entityKind} ${g.entityKey}` });
}
export async function listAutomationGrants(orgId: string): Promise<{ workflowId: string; entityKind: EntityKind; entityKey: string; level: AccessLevel }[]> {
  return prisma.automationGrant.findMany({ where: { orgId }, select: { workflowId: true, entityKind: true, entityKey: true, level: true } });
}
