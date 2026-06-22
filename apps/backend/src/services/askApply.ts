/**
 * Ask AISDR (модуль 10, M26-2) — РЕАЛЬНОЕ применение предложенных действий.
 *
 * Действие предложено и сохранено в M26-1 как канонический AskAction (PENDING).
 * Здесь — apply: читаем СОХРАНЁННЫЙ canonical payload (НЕ пересобираем из текста и
 * НЕ зовём заново LLM), повторно проверяем RBAC, исполняем и фиксируем результат.
 *
 * Гарантии (обяз. правки GPT + адверс-ревью):
 *  • Атомарность: claim PENDING→APPLIED, side-effect и запись appliedResult идут в ОДНОЙ
 *    транзакции. Падение side-effect откатывает claim (статус остаётся PENDING) — нет
 *    «фантомного APPLIED без результата» и нет ручного revert. После commit status=APPLIED
 *    И appliedResult записаны вместе.
 *  • Idempotency: claim-CAS (updateMany WHERE status=PENDING) + @@unique([orgId, idempotencyKey]).
 *    Повторный confirm/double-click не создаёт второй Task/draft и не применяет второй update.
 *  • RBAC re-check на apply: UPDATE_RECORD требует OBJECT READ_WRITE СЕЙЧАС (доступ мог измениться).
 *  • Никаких тихих внешних отправок: DRAFT_EMAIL создаёт ТОЛЬКО внутренний черновик.
 *  • Audit без утечки контента: ASK_ACTION_APPLIED пишет тип/targetId, не тело письма/ответа.
 */

import { PrismaClient, Prisma, ActivityType } from '@prisma/client';
import { buildResolver, meets } from './permissions';
import { writeValues } from './crm/values';
import { runWorkflows } from './workflows';
import { triggerAutoRerunForChange } from './ai/index';
import { audit } from './audit';
import type { AskAction } from './ask';

const prisma = new PrismaClient();

export class AskApplyError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = 'AskApplyError';
  }
}

export interface ApplyOutcome {
  applied: boolean;
  idempotent: boolean;
  kind: string;
  status: string;
  result: unknown;
}

interface ActorCtx {
  orgId: string;
  userId: string;
  role: string | null | undefined;
}

type Tx = Prisma.TransactionClient;

// ─── публичная точка входа ───────────────────────────────────────────────────

export async function applyAskAction(ctx: ActorCtx, actionId: string, clientRequestId?: string): Promise<ApplyOutcome> {
  const action = await prisma.askAction.findFirst({
    where: { id: actionId, orgId: ctx.orgId, userId: ctx.userId }, // только своё действие, иначе 404 (скрытие)
  });
  if (!action) throw new AskApplyError(404, 'ACTION_NOT_FOUND', 'Action not found');

  // уже применено → идемпотентно вернуть сохранённый результат (после commit appliedResult всегда записан)
  if (action.status === 'APPLIED') {
    return { applied: true, idempotent: true, kind: action.kind, status: 'APPLIED', result: action.appliedResult ?? null };
  }
  if (action.status === 'DISMISSED') throw new AskApplyError(409, 'ACTION_DISMISSED', 'Action was dismissed');
  // NAVIGATE исполняется на клиенте (router.push) — на сервере применять нечего
  if (action.kind === 'NAVIGATE') throw new AskApplyError(400, 'NAVIGATE_CLIENT_SIDE', 'Navigate actions are applied in the client');

  const idempotencyKey = `ask-action:${ctx.orgId}:${action.chatId}:${action.messageId}:${action.kind}:${clientRequestId ?? action.id}`;
  const payload = action.payload as unknown as AskAction;

  // RBAC/валидация (read-only) ДО транзакции — fail-fast с корректным статусом.
  const prepared = await prepareSideEffect(ctx, action.kind, payload);

  let result: unknown;
  let postCommit: (() => Promise<void>) | null = null;
  let idempotent = false;

  try {
    const out = await prisma.$transaction(async (tx) => {
      // claim-CAS: только один запрос переведёт PENDING→APPLIED (Postgres держит row-lock до commit)
      const claim = await tx.askAction.updateMany({
        where: { id: action.id, orgId: ctx.orgId, userId: ctx.userId, status: 'PENDING' },
        data: { status: 'APPLIED', appliedAt: new Date(), idempotencyKey },
      });
      if (claim.count === 0) {
        const fresh = await tx.askAction.findUnique({ where: { id: action.id } });
        if (fresh?.status === 'APPLIED') return { idem: true, result: fresh.appliedResult ?? null, post: null as (() => Promise<void>) | null };
        throw new AskApplyError(409, 'ACTION_IN_PROGRESS', 'Action is already being applied');
      }

      // side-effect В ТОЙ ЖЕ транзакции — падение откатит и claim
      const eff = await runSideEffect(tx, ctx, action.id, action.kind, prepared);
      await tx.askAction.update({ where: { id: action.id }, data: { appliedResult: eff.result as Prisma.InputJsonValue } });
      return { idem: false, result: eff.result, post: eff.postCommit };
    });
    result = out.result;
    idempotent = out.idem;
    postCommit = out.post;
  } catch (err) {
    // конфликт по @@unique([orgId, idempotencyKey]) — тот же ключ уже использован (двойной клик) → идемпотентно
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const fresh = await prisma.askAction.findUnique({ where: { id: action.id } });
      return { applied: true, idempotent: true, kind: action.kind, status: fresh?.status ?? 'APPLIED', result: fresh?.appliedResult ?? null };
    }
    throw err; // транзакция откатилась → статус остался PENDING, пользователь может повторить
  }

  if (!idempotent) {
    void audit({ orgId: ctx.orgId, actorId: ctx.userId, action: 'ASK_ACTION_APPLIED', targetType: 'AskAction', targetId: action.id, summary: `Applied ${action.kind}` });
    if (postCommit) await postCommit().catch(() => undefined); // workflow/auto-rerun триггеры — после commit
  }
  return { applied: true, idempotent, kind: action.kind, status: 'APPLIED', result };
}

// ─── подготовка (RBAC/валидация вне транзакции) ───────────────────────────────

interface PreparedTask { recordId: string | null }
interface PreparedUpdate { record: { id: string; orgId: string; objectId: string }; attributeKey: string; value: unknown; attributeLabel: string; newDisplay: string }
interface PreparedDraft { leadId: string | null; recordId: string | null; toName: string | null; toEmail: string | null; subject: string; body: string }
type Prepared = { kind: 'CREATE_TASK'; task: PreparedTask; raw: AskAction } | { kind: 'UPDATE_RECORD'; upd: PreparedUpdate } | { kind: 'DRAFT_EMAIL'; draft: PreparedDraft };

async function prepareSideEffect(ctx: ActorCtx, kind: string, payload: AskAction): Promise<Prepared> {
  if (kind === 'CREATE_TASK') {
    const t = payload.task;
    if (!t?.title) throw new AskApplyError(422, 'INVALID_TASK', 'Task title is required');
    let recordId: string | null = null;
    if (t.recordId) {
      const rec = await prisma.record.findFirst({ where: { id: t.recordId, orgId: ctx.orgId, archivedAt: null }, select: { id: true, objectId: true } });
      if (rec) {
        const resolver = await buildResolver(ctx.orgId, { userId: ctx.userId, role: ctx.role }, 'OBJECT');
        if (meets(resolver(rec.objectId), 'READ')) recordId = rec.id;
      }
    }
    return { kind: 'CREATE_TASK', task: { recordId }, raw: payload };
  }

  if (kind === 'UPDATE_RECORD') {
    const u = payload.update;
    if (!u?.recordId || !u.attributeKey) throw new AskApplyError(422, 'INVALID_UPDATE', 'recordId and attributeKey are required');
    const rec = await prisma.record.findFirst({ where: { id: u.recordId, orgId: ctx.orgId, archivedAt: null }, select: { id: true, orgId: true, objectId: true } });
    if (!rec) throw new AskApplyError(404, 'RECORD_NOT_FOUND', 'Record not found');
    // RBAC re-check СЕЙЧАС: запись значения = OBJECT READ_WRITE (доступ мог быть отозван после генерации)
    const resolver = await buildResolver(ctx.orgId, { userId: ctx.userId, role: ctx.role }, 'OBJECT');
    if (!meets(resolver(rec.objectId), 'READ_WRITE')) throw new AskApplyError(403, 'PERMISSION_DENIED', 'You don’t have write access to this record');
    return { kind: 'UPDATE_RECORD', upd: { record: rec, attributeKey: u.attributeKey, value: u.value, attributeLabel: u.attributeLabel, newDisplay: u.newDisplay } };
  }

  if (kind === 'DRAFT_EMAIL') {
    const d = payload.draft;
    if (!d?.subject || !d?.body) throw new AskApplyError(422, 'INVALID_DRAFT', 'subject and body are required');
    let leadId: string | null = null;
    let recordId: string | null = null;
    let toEmail: string | null = d.toEmail ?? null;
    let toName: string | null = d.toName ?? null;
    if (d.leadId) {
      const lead = await prisma.lead.findFirst({ where: { id: d.leadId, orgId: ctx.orgId }, select: { id: true, email: true, firstName: true, lastName: true } });
      if (lead) {
        leadId = lead.id;
        if (!toEmail) toEmail = lead.email ?? null;
        if (!toName) toName = `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim() || null;
      }
    }
    if (d.recordId) {
      const rec = await prisma.record.findFirst({ where: { id: d.recordId, orgId: ctx.orgId, archivedAt: null }, select: { id: true, objectId: true } });
      if (rec) {
        const resolver = await buildResolver(ctx.orgId, { userId: ctx.userId, role: ctx.role }, 'OBJECT');
        if (meets(resolver(rec.objectId), 'READ')) recordId = rec.id;
      }
    }
    return { kind: 'DRAFT_EMAIL', draft: { leadId, recordId, toName, toEmail, subject: d.subject.slice(0, 300), body: d.body.slice(0, 8000) } };
  }

  throw new AskApplyError(400, 'UNKNOWN_KIND', `Unknown action kind ${kind}`);
}

// ─── исполнение side-effect внутри транзакции ─────────────────────────────────

async function runSideEffect(tx: Tx, ctx: ActorCtx, actionId: string, kind: string, prepared: Prepared): Promise<{ result: unknown; postCommit: (() => Promise<void>) | null }> {
  if (prepared.kind === 'CREATE_TASK') return applyCreateTask(tx, ctx, prepared);
  if (prepared.kind === 'UPDATE_RECORD') return applyUpdateRecord(tx, ctx, prepared);
  if (prepared.kind === 'DRAFT_EMAIL') return applyDraftEmail(tx, ctx, actionId, prepared);
  throw new AskApplyError(400, 'UNKNOWN_KIND', `Unknown action kind ${kind}`);
}

// CREATE_TASK → реальный Task (заменяет MVP-«reminder» из M26-1, условие GPT)
async function applyCreateTask(tx: Tx, ctx: ActorCtx, p: Extract<Prepared, { kind: 'CREATE_TASK' }>): Promise<{ result: unknown; postCommit: null }> {
  const t = p.raw.task!;
  const recordId = p.task.recordId;
  // Task привязывается к Record (не к Lead) — контекст лида кладём в описание
  const descParts: string[] = [];
  if (t.body) descParts.push(t.body);
  if (t.leadName || t.leadId) descParts.push(`Related lead: ${t.leadName ?? t.leadId}`);
  descParts.push('Created from Ask AISDR · confirmed by you');

  const task = await tx.task.create({
    data: { orgId: ctx.orgId, title: t.title.slice(0, 200), description: descParts.filter(Boolean).join('\n\n').slice(0, 2000), assigneeId: ctx.userId, createdById: ctx.userId, recordId },
    select: { id: true, title: true },
  });
  if (recordId) {
    await tx.activity.create({ data: { orgId: ctx.orgId, recordId, actorId: ctx.userId, type: ActivityType.TASK_CREATED, title: 'Task created', payload: { taskId: task.id, source: 'ask' } as Prisma.InputJsonValue } });
  }
  return { result: { type: 'task', taskId: task.id, title: task.title, recordLinked: !!recordId, href: '/dashboard' }, postCommit: null };
}

// UPDATE_RECORD → реальная запись значения через writeValues; workflow/auto-rerun — после commit
async function applyUpdateRecord(tx: Tx, ctx: ActorCtx, p: Extract<Prepared, { kind: 'UPDATE_RECORD' }>): Promise<{ result: unknown; postCommit: () => Promise<void> }> {
  const rec = p.upd.record;
  await tx.record.update({ where: { id: rec.id }, data: { updatedById: ctx.userId } });
  // writeValues сам валидирует/коэрсит значение по типу атрибута (бросит CrmValueValidationError → 422, tx откатится)
  const changed = await writeValues(tx, rec, { [p.upd.attributeKey]: p.upd.value }, { actorId: ctx.userId });
  const act = await tx.activity.create({
    data: { orgId: ctx.orgId, recordId: rec.id, actorId: ctx.userId, type: ActivityType.RECORD_UPDATED, title: 'Record updated', payload: { recordId: rec.id, valueKeys: [p.upd.attributeKey], changedAttributeIds: changed, source: 'ask' } as Prisma.InputJsonValue },
  });
  const activityId = act.id;

  const postCommit = async () => {
    if (changed.length === 0) return;
    await runWorkflows({ orgId: ctx.orgId, trigger: 'RECORD_UPDATED', recordId: rec.id, objectId: rec.objectId, idempotencyKey: `rec-updated:${rec.id}:${activityId}` }).catch(() => undefined);
    for (const attrId of changed) {
      await runWorkflows({ orgId: ctx.orgId, trigger: 'ATTRIBUTE_UPDATED', recordId: rec.id, objectId: rec.objectId, idempotencyKey: `attr-updated:${rec.id}:${attrId}:${activityId}` }).catch(() => undefined);
      await triggerAutoRerunForChange({ orgId: ctx.orgId, recordId: rec.id, objectId: rec.objectId, changedAttributeId: attrId, sourceActivityId: activityId }).catch(() => undefined);
    }
  };

  return { result: { type: 'record_update', recordId: rec.id, attributeKey: p.upd.attributeKey, attributeLabel: p.upd.attributeLabel, newDisplay: p.upd.newDisplay, changed: changed.length > 0 }, postCommit };
}

// DRAFT_EMAIL → внутренний черновик (НИКАКОЙ внешней отправки)
async function applyDraftEmail(tx: Tx, ctx: ActorCtx, actionId: string, p: Extract<Prepared, { kind: 'DRAFT_EMAIL' }>): Promise<{ result: unknown; postCommit: null }> {
  const d = p.draft;
  const draft = await tx.askEmailDraft.create({
    data: { orgId: ctx.orgId, userId: ctx.userId, leadId: d.leadId, recordId: d.recordId, toName: d.toName, toEmail: d.toEmail, subject: d.subject, body: d.body, sourceActionId: actionId, status: 'DRAFT' },
    select: { id: true },
  });
  if (d.recordId) {
    await tx.activity.create({ data: { orgId: ctx.orgId, recordId: d.recordId, actorId: ctx.userId, type: ActivityType.EMAIL_DRAFTED, title: 'Email drafted', payload: { draftId: draft.id, source: 'ask' } as Prisma.InputJsonValue } });
  }
  return { result: { type: 'email_draft', draftId: draft.id, sendable: false, note: 'Draft saved. Sending is unavailable until a mailbox/SMTP is connected.' }, postCommit: null };
}
