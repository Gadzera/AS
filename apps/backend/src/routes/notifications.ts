/**
 * Notification Center (M22-1) — PER-USER. Читаем через NotificationRecipient (read-state у каждого свой).
 *  GET    /api/notifications?type= — мои уведомления (+ readAt мой) + счётчики по типам.
 *  GET    /api/notifications/count — мои непрочитанные (бейдж).
 *  PATCH  /api/notifications/:id   — пометить МОЁ уведомление прочитанным.
 *  POST   /api/notifications/read-all — пометить все мои непрочитанные прочитанными.
 *  POST   /api/notifications      — ручное системное уведомление (broadcast).
 * Tasks/Assignments — в enum, но fire-site'ов нет → UI показывает их disabled (не harness).
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient, NotificationType } from '@prisma/client';
import { authenticate, requireOrg } from '../middleware/auth';
import { notify } from '../services/notifications';
import { isManager } from '../services/permissions';
import { buildUserDigest, sendUserDigest, lastDigestAt } from '../services/notificationDigest';

const DIGEST_MANUAL_GAP_MS = 60 * 60_000; // ручной «Send now» не чаще раза в час (анти-спам, адверс-ревью #7)

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate, requireOrg);

// типы, у которых есть реальные fire-site'ы в M22-1 (для честного UI)
const LIVE_TYPES: NotificationType[] = ['MENTION', 'REPLY', 'SYSTEM'];

router.get('/count', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const unread = await prisma.notificationRecipient.count({ where: { orgId: req.user!.orgId!, userId: req.user!.userId, readAt: null } });
    res.json({ unread });
  } catch (err) { next(err); }
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId;
    const type = typeof req.query.type === 'string' && req.query.type !== 'ALL' ? (req.query.type as NotificationType) : undefined;

    const rows = await prisma.notificationRecipient.findMany({
      where: { orgId, userId, ...(type ? { notification: { type } } : {}) },
      include: { notification: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // имена лидов для deep-link (entity record/comment линкуется на фронте по entityId)
    const leadIds = [...new Set(rows.map((r) => r.notification.leadId).filter(Boolean) as string[])];
    const leads = leadIds.length ? await prisma.lead.findMany({ where: { id: { in: leadIds }, orgId }, select: { id: true, firstName: true, lastName: true } }) : [];
    const leadMap = new Map(leads.map((l) => [l.id, `${l.firstName} ${l.lastName}`]));

    const notifications = rows.map((r) => ({
      id: r.notification.id, type: r.notification.type, source: r.notification.source,
      title: r.notification.title, body: r.notification.body, entityType: r.notification.entityType, entityId: r.notification.entityId,
      leadId: r.notification.leadId, leadName: r.notification.leadId ? leadMap.get(r.notification.leadId) ?? null : null,
      createdAt: r.notification.createdAt, readAt: r.readAt, // per-user read-state
    }));

    // счётчики непрочитанного по типам (для табов)
    const grouped = await prisma.notificationRecipient.groupBy({ by: ['notificationId'], where: { orgId, userId, readAt: null }, _count: { _all: true } });
    const unreadIds = grouped.map((g) => g.notificationId);
    const unreadNotifs = unreadIds.length ? await prisma.notification.findMany({ where: { id: { in: unreadIds } }, select: { type: true } }) : [];
    const counts: Record<string, number> = { ALL: 0, MENTION: 0, REPLY: 0, SYSTEM: 0, TASK_ASSIGNED: 0, RECORD_ASSIGNED: 0 };
    for (const n of unreadNotifs) { counts[n.type] = (counts[n.type] ?? 0) + 1; counts.ALL += 1; }

    res.json({ notifications, counts, liveTypes: LIVE_TYPES });
  } catch (err) { next(err); }
});

const createSchema = z.object({ title: z.string().min(1).max(200), body: z.string().max(2000).optional(), leadId: z.string().optional() });
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // адверс-ревью #3: broadcast всем членам = admin-действие (иначе любой шлёт спам всему воркспейсу)
    if (!isManager(req.user!.role)) { res.status(403).json({ error: 'Only the owner or an admin can broadcast notifications', code: 'NOTIF_ADMIN_ONLY' }); return; }
    const orgId = req.user!.orgId!;
    const data = createSchema.parse(req.body);
    await notify({ orgId, source: 'SYSTEM', type: 'SYSTEM', title: data.title, body: data.body, leadId: data.leadId ?? null, entityType: data.leadId ? 'lead' : undefined, entityId: data.leadId });
    res.status(201).json({ ok: true });
  } catch (err) { next(err); }
});

// PATCH /:id — пометить МОЁ уведомление прочитанным/непрочитанным (per-user)
const patchSchema = z.object({ read: z.boolean().default(true) });
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { read } = patchSchema.parse(req.body);
    const r = await prisma.notificationRecipient.updateMany({
      where: { orgId, userId: req.user!.userId, notificationId: req.params.id },
      data: { readAt: read ? new Date() : null },
    });
    if (r.count === 0) { res.status(404).json({ error: 'Notification not found', code: 'NOTIF_NOT_FOUND' }); return; }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/read-all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await prisma.notificationRecipient.updateMany({ where: { orgId: req.user!.orgId!, userId: req.user!.userId, readAt: null }, data: { readAt: new Date() } });
    res.json({ updated: r.count });
  } catch (err) { next(err); }
});

// M22-2: GET /digest — preview МОЕГО дайджеста (access-filtered, honest no-SMTP статус)
router.get('/digest', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hours = Math.min(Math.max(Number(req.query.hours) || 24, 1), 168);
    const d = await buildUserDigest(req.user!.orgId!, req.user!.userId, hours);
    res.json(d);
  } catch (err) { next(err); }
});

// POST /digest/send — отправить МОЙ дайджест сейчас (или honest-skip без SMTP). Возвращает статус.
router.post('/digest/send', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId;
    // адверс-ревью #7: ручной self-send не чаще раза в час (иначе спам строк/писем). Воркер не ограничен этим (свой gap 20ч).
    const last = await lastDigestAt(orgId, userId);
    if (last && Date.now() - last.getTime() < DIGEST_MANUAL_GAP_MS) {
      res.status(429).json({ error: 'A digest was sent recently — try again later', code: 'DIGEST_RATE_LIMITED', retryAfterMin: Math.ceil((DIGEST_MANUAL_GAP_MS - (Date.now() - last.getTime())) / 60000) });
      return;
    }
    const r = await sendUserDigest(orgId, userId);
    res.json(r);
  } catch (err) { next(err); }
});

export default router;
