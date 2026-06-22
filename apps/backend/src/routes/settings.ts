/**
 * Настройки воркспейса (M11). Реальные данные:
 *  - GET/PATCH /api/settings/workspace — имя, таймзона, окно отправки, дни, дневной лимит.
 *  - GET/POST/PATCH/DELETE /api/settings/mailboxes — подключённые ящики отправки (deliverability).
 * Правки воркспейса и ящиков — только OWNER/ADMIN. Фактическая отправка писем — демо до
 * подключения внешнего SMTP/OAuth; запись о ящике (статус/прогрев/лимит) полностью реальная.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireOrg } from '../middleware/auth';
import { audit } from '../services/audit';
import { syncMeeting } from '../services/calendar';
import { config } from '../config';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate, requireOrg);

// GET /api/settings/integrations — ЧЕСТНЫЙ статус внешних интеграций: только факт «настроено ли»
// (boolean из server-side config), БЕЗ раскрытия значений ключей. Никакого fake-connected.
router.get('/integrations', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const integrations = [
      { name: 'DeepSeek (LLM)', key: 'DEEPSEEK_API_KEY', required: true, configured: Boolean(config.deepseek.apiKey.trim()), purpose: 'AI generation, research, classification' },
      { name: 'Apollo.io', key: 'APOLLO_API_KEY', required: false, configured: Boolean(config.apollo.apiKey.trim()), purpose: 'Lead enrichment & sourcing' },
      { name: 'Unipile (LinkedIn)', key: 'UNIPILE_API_KEY', required: false, configured: Boolean(config.unipile.apiKey.trim()), purpose: 'LinkedIn outreach' },
      { name: 'Stripe', key: 'STRIPE_SECRET_KEY', required: false, configured: Boolean(config.stripe.secretKey.trim()), purpose: 'Real billing & credit purchases' },
      { name: 'SMTP Email', key: 'SMTP_HOST', required: false, configured: Boolean(config.smtp.user.trim() && config.smtp.pass.trim()), purpose: 'Real email delivery' },
    ];
    res.json({ integrations });
  } catch (err) {
    next(err);
  }
});

function canManage(role: string): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

function requireManager(req: Request, res: Response): boolean {
  if (!canManage(req.user!.role)) {
    res.status(403).json({ error: 'Only the owner or an admin can change workspace settings' });
    return false;
  }
  return true;
}

// ───────────────────────── Workspace ─────────────────────────

function serializeWorkspace(org: {
  id: string; name: string; plan: string; leadsLimit: number;
  timezone: string; sendWindowStart: string; sendWindowEnd: string; sendDays: string; dailySendLimit: number;
  autoResponseEnabled: boolean; autoResponseMinConfidence: number;
  logoUrl: string | null; companyDomain: string | null;
}) {
  return {
    id: org.id,
    name: org.name,
    plan: org.plan,
    leadsLimit: org.leadsLimit,
    timezone: org.timezone,
    sendWindowStart: org.sendWindowStart,
    sendWindowEnd: org.sendWindowEnd,
    sendDays: org.sendDays.split(',').map((d) => d.trim()).filter(Boolean),
    dailySendLimit: org.dailySendLimit,
    // M14-5: автопилот авто-ответа.
    autoResponseEnabled: org.autoResponseEnabled,
    autoResponseMinConfidence: org.autoResponseMinConfidence,
    // M23-2: Workspace General
    logoUrl: org.logoUrl,
    companyDomain: org.companyDomain,
  };
}

router.get('/workspace', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const org = await prisma.organization.findUnique({ where: { id: req.user!.orgId! } });
    if (!org) {
      res.status(404).json({ error: 'Workspace not found' });
      return;
    }
    res.json({ workspace: serializeWorkspace(org), canManage: canManage(req.user!.role) });
  } catch (err) {
    next(err);
  }
});

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
const workspaceSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  timezone: z.string().min(1).max(64).optional(),
  sendWindowStart: z.string().regex(timeRe, 'HH:MM').optional(),
  sendWindowEnd: z.string().regex(timeRe, 'HH:MM').optional(),
  sendDays: z.array(z.string().regex(/^[1-7]$/)).min(1).max(7).optional(),
  dailySendLimit: z.number().int().min(1).max(2000).optional(),
  // M14-5: автопилот авто-ответа (вкл/выкл + порог уверенности 0.5..1).
  autoResponseEnabled: z.boolean().optional(),
  autoResponseMinConfidence: z.number().min(0.5).max(1).optional(),
  // M23-2: logo = http(s) URL (или пусто → null); domain = домен компании (или пусто → null). Валидируем.
  logoUrl: z.string().max(500).nullish().refine((v) => !v || /^https?:\/\/[^\s]+$/i.test(v.trim()), 'Logo must be an http(s) URL'),
  companyDomain: z.string().max(120).nullish().refine((v) => !v || /^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(v.trim()), 'Enter a valid domain (e.g. acme.com)'),
});

router.patch('/workspace', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!requireManager(req, res)) return;
    const data = workspaceSchema.parse(req.body);
    const update: Record<string, unknown> = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.timezone !== undefined) update.timezone = data.timezone;
    if (data.sendWindowStart !== undefined) update.sendWindowStart = data.sendWindowStart;
    if (data.sendWindowEnd !== undefined) update.sendWindowEnd = data.sendWindowEnd;
    if (data.sendDays !== undefined) update.sendDays = [...new Set(data.sendDays)].sort().join(',');
    if (data.dailySendLimit !== undefined) update.dailySendLimit = data.dailySendLimit;
    if (data.autoResponseEnabled !== undefined) update.autoResponseEnabled = data.autoResponseEnabled;
    if (data.autoResponseMinConfidence !== undefined) update.autoResponseMinConfidence = data.autoResponseMinConfidence;
    if (data.logoUrl !== undefined) update.logoUrl = data.logoUrl ? data.logoUrl.trim() : null;
    if (data.companyDomain !== undefined) update.companyDomain = data.companyDomain ? data.companyDomain.trim().toLowerCase() : null;

    const org = await prisma.organization.update({ where: { id: req.user!.orgId! }, data: update });
    res.json({ workspace: serializeWorkspace(org), canManage: true });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: err.issues[0]?.message ?? 'Invalid workspace settings', code: 'WORKSPACE_INVALID', issues: err.issues }); return; }
    next(err);
  }
});

// ───────────────────────── Calendar ─────────────────────────

router.get('/calendar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const org = await prisma.organization.findUnique({ where: { id: req.user!.orgId! }, select: { calendarProvider: true, calendarConnectedAt: true } });
    res.json({ connected: !!org?.calendarProvider, provider: org?.calendarProvider ?? null, connectedAt: org?.calendarConnectedAt ?? null, canManage: canManage(req.user!.role) });
  } catch (err) { next(err); }
});

router.post('/calendar/connect', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!requireManager(req, res)) return;
    const provider = z.object({ provider: z.enum(['GOOGLE', 'OUTLOOK']) }).parse(req.body).provider;
    const orgId = req.user!.orgId!;
    await prisma.organization.update({ where: { id: orgId }, data: { calendarProvider: provider, calendarConnectedAt: new Date() } });
    // Подтянуть все ещё не синхронизированные встречи к новому календарю.
    const pending = await prisma.meeting.findMany({ where: { orgId, archivedAt: null, syncStatus: { in: ['PENDING', 'NOT_CONNECTED', 'FAILED'] } }, select: { id: true } });
    for (const m of pending) await syncMeeting(orgId, m.id);
    res.json({ connected: true, provider, synced: pending.length });
  } catch (err) { next(err); }
});

router.post('/calendar/disconnect', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!requireManager(req, res)) return;
    const orgId = req.user!.orgId!;
    await prisma.organization.update({ where: { id: orgId }, data: { calendarProvider: null, calendarConnectedAt: null } });
    // Встречи помечаем как несинхронизированные (внешний календарь больше не связан).
    await prisma.meeting.updateMany({ where: { orgId, archivedAt: null, syncStatus: 'SYNCED' }, data: { syncStatus: 'NOT_CONNECTED', externalEventId: null, syncedAt: null, syncError: 'Calendar disconnected' } });
    res.json({ connected: false });
  } catch (err) { next(err); }
});

// ───────────────────────── Mailboxes ─────────────────────────

const PROVIDERS = ['SMTP', 'GMAIL', 'OUTLOOK'] as const;
const STATUSES = ['CONNECTED', 'WARMING', 'PAUSED', 'ERROR'] as const;

router.get('/mailboxes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const mailboxes = await prisma.mailbox.findMany({
      where: { orgId, archivedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    const summary = {
      total: mailboxes.length,
      healthy: mailboxes.filter((m) => m.status === 'CONNECTED').length,
      warming: mailboxes.filter((m) => m.status === 'WARMING').length,
      dailyCapacity: mailboxes.filter((m) => m.status !== 'PAUSED' && m.status !== 'ERROR').reduce((s, m) => s + m.dailyLimit, 0),
    };
    res.json({ mailboxes, summary, canManage: canManage(req.user!.role) });
  } catch (err) {
    next(err);
  }
});

const createMailboxSchema = z.object({
  address: z.string().email(),
  fromName: z.string().max(120).optional(),
  provider: z.enum(PROVIDERS).optional(),
  dailyLimit: z.number().int().min(1).max(1000).optional(),
});

router.post('/mailboxes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!requireManager(req, res)) return;
    const orgId = req.user!.orgId!;
    const data = createMailboxSchema.parse(req.body);

    const dup = await prisma.mailbox.findFirst({ where: { orgId, address: data.address, archivedAt: null } });
    if (dup) {
      res.status(409).json({ error: 'This address is already connected' });
      return;
    }

    const count = await prisma.mailbox.count({ where: { orgId, archivedAt: null } });
    // Новый ящик стартует в прогреве (как при реальном подключении домена). Первый ящик — дефолтный.
    const mailbox = await prisma.mailbox.create({
      data: {
        orgId,
        address: data.address,
        fromName: data.fromName ?? null,
        provider: data.provider ?? 'SMTP',
        status: 'WARMING',
        dailyLimit: data.dailyLimit ?? 50,
        warmupDay: 1,
        healthPct: 55,
        isDefault: count === 0,
      },
    });
    await audit({ orgId, actorId: req.user!.userId, actorName: req.user!.email, action: 'MAILBOX_CONNECTED', targetType: 'mailbox', targetId: mailbox.id, summary: `Connected mailbox ${mailbox.address} (${mailbox.provider})` });
    res.status(201).json({ mailbox });
  } catch (err) {
    next(err);
  }
});

const updateMailboxSchema = z.object({
  fromName: z.string().max(120).nullable().optional(),
  dailyLimit: z.number().int().min(1).max(1000).optional(),
  status: z.enum(STATUSES).optional(),
  isDefault: z.boolean().optional(),
});

router.patch('/mailboxes/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!requireManager(req, res)) return;
    const orgId = req.user!.orgId!;
    const existing = await prisma.mailbox.findFirst({ where: { id: req.params.id, orgId, archivedAt: null } });
    if (!existing) {
      res.status(404).json({ error: 'Mailbox not found' });
      return;
    }
    const data = updateMailboxSchema.parse(req.body);

    const update: Record<string, unknown> = {};
    if (data.fromName !== undefined) update.fromName = data.fromName;
    if (data.dailyLimit !== undefined) update.dailyLimit = data.dailyLimit;
    if (data.status !== undefined) update.status = data.status;
    if (data.isDefault !== undefined) update.isDefault = data.isDefault;

    // Дефолтным может быть только один ящик — снимаем флаг с остальных в ОДНОЙ транзакции.
    const [, mailbox] = await prisma.$transaction([
      data.isDefault === true
        ? prisma.mailbox.updateMany({ where: { orgId, NOT: { id: existing.id } }, data: { isDefault: false } })
        : prisma.mailbox.updateMany({ where: { id: existing.id }, data: {} }),
      prisma.mailbox.update({ where: { id: existing.id }, data: update }),
    ]);
    res.json({ mailbox });
  } catch (err) {
    next(err);
  }
});

router.delete('/mailboxes/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!requireManager(req, res)) return;
    const orgId = req.user!.orgId!;
    const existing = await prisma.mailbox.findFirst({ where: { id: req.params.id, orgId, archivedAt: null } });
    if (!existing) {
      res.status(404).json({ error: 'Mailbox not found' });
      return;
    }
    await prisma.mailbox.update({ where: { id: existing.id }, data: { archivedAt: new Date(), isDefault: false } });
    await audit({ orgId, actorId: req.user!.userId, actorName: req.user!.email, action: 'MAILBOX_DISCONNECTED', targetType: 'mailbox', targetId: existing.id, summary: `Disconnected mailbox ${existing.address}` });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
