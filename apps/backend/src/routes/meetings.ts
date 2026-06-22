import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient, MeetingStatus, MeetingOutcome } from '@prisma/client';
import { z } from 'zod';

import { authenticate, requireOrg } from '../middleware/auth';
import { runWorkflows } from '../services/workflows';
import { syncMeeting, cancelMeetingSync } from '../services/calendar';
import { scheduleMeetingFromReply } from '../services/meetingSchedule';
import { setMeetingOutcome } from '../services/meetingOutcome';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate, requireOrg);

const createSchema = z.object({
  title: z.string().min(1).max(160).optional(), // M15-2: для reply-пути заголовок подставит сервис
  leadId: z.string().optional(),
  replyMessageId: z.string().optional(), // M15-2: атрибуция встречи к ответу
  company: z.string().max(160).optional(),
  scheduledAt: z.string().datetime().optional(),
  durationMin: z.coerce.number().int().min(5).max(480).optional(),
  status: z.nativeEnum(MeetingStatus).optional(),
  source: z.string().max(40).optional(),
  notes: z.string().max(4000).optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  durationMin: z.coerce.number().int().min(5).max(480).optional(),
  status: z.nativeEnum(MeetingStatus).optional(),
  outcome: z.string().max(2000).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
});

// GET /api/meetings?status=
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const meetings = await prisma.meeting.findMany({
      where: { orgId, archivedAt: null, ...(status ? { status: status as MeetingStatus } : {}) },
      orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    });
    // сводка по статусам
    const grouped = await prisma.meeting.groupBy({ by: ['status'], where: { orgId, archivedAt: null }, _count: { _all: true } });
    const counts: Record<string, number> = {};
    for (const g of grouped) counts[g.status] = g._count._all;
    res.json({ meetings, counts });
  } catch (err) { next(err); }
});

// POST /api/meetings — M15-2: атрибутированное создание через scheduleMeetingFromReply (reply/manual),
// DB-level идемпотентность по replyMessageId, сайд-эффекты (lead→HOT/handledAt/audit/workflow) один раз.
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const data = createSchema.parse(req.body);
    const r = await scheduleMeetingFromReply({
      orgId, replyMessageId: data.replyMessageId ?? null, leadId: data.leadId ?? null,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null, durationMin: data.durationMin,
      title: data.title, company: data.company, notes: data.notes, createdById: req.user!.userId,
    });
    if (!r.ok) { res.status(r.reason?.endsWith('not_found') ? 404 : 400).json({ error: r.reason }); return; }
    const fresh = await prisma.meeting.findUnique({ where: { id: r.meetingId } });
    res.status(r.duplicate ? 200 : 201).json({ ...fresh, duplicate: !!r.duplicate, workflowsTriggered: r.workflowsTriggered ?? 0 });
  } catch (err) { next(err); }
});

// PATCH /api/meetings/:id
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const data = updateSchema.parse(req.body);
    const existing = await prisma.meeting.findFirst({ where: { id: req.params.id, orgId, archivedAt: null }, select: { id: true } });
    if (!existing) { res.status(404).json({ error: 'Meeting not found' }); return; }
    const meeting = await prisma.meeting.update({
      where: { id: existing.id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.scheduledAt !== undefined && { scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null }),
        ...(data.durationMin !== undefined && { durationMin: data.durationMin }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.outcome !== undefined && { outcome: data.outcome }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
    });

    // Связанный pipeline-state лида: завершённая встреча с исходом двигает статус лида.
    if (meeting.status === MeetingStatus.COMPLETED && meeting.leadId) {
      const out = (meeting.outcome ?? '').toLowerCase();
      const leadStatus = /qualified/.test(out) ? 'CONVERTED' : /not a fit/.test(out) ? 'LOST' : null;
      if (leadStatus) {
        await prisma.lead
          .updateMany({ where: { id: meeting.leadId, orgId }, data: { status: leadStatus as 'CONVERTED' | 'LOST' } })
          .catch(() => undefined);
      }
    }

    // Календарь: отмена встречи → отмена внешнего события; перенос времени → ресинк.
    if (data.status === MeetingStatus.CANCELED) {
      await cancelMeetingSync(orgId, meeting.id);
    } else if (data.scheduledAt !== undefined && meeting.syncStatus !== 'NOT_CONNECTED') {
      await syncMeeting(orgId, meeting.id);
    }

    const fresh = await prisma.meeting.findUnique({ where: { id: meeting.id } });
    res.json(fresh ?? meeting);
  } catch (err) { next(err); }
});

// M15-4: POST /api/meetings/:id/outcome { outcome } — типизированный исход + sync лида/аудит/HandoffPackage (идемпотентно).
const outcomeSchema = z.object({ outcome: z.nativeEnum(MeetingOutcome) });
router.post('/:id/outcome', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { outcome } = outcomeSchema.parse(req.body);
    const r = await setMeetingOutcome(orgId, req.params.id, outcome, req.user!.userId);
    if (!r.ok) { res.status(r.reason === 'meeting_not_found' ? 404 : 400).json({ error: r.reason }); return; }
    const fresh = await prisma.meeting.findUnique({ where: { id: req.params.id } });
    res.json({ ok: true, changed: !!r.changed, leadStatus: r.leadStatus ?? null, meeting: fresh });
  } catch (err) { next(err); }
});

// POST /api/meetings/:id/sync — повторная синхронизация (retry) для PENDING/FAILED/NOT_CONNECTED.
router.post('/:id/sync', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const existing = await prisma.meeting.findFirst({ where: { id: req.params.id, orgId, archivedAt: null }, select: { id: true } });
    if (!existing) { res.status(404).json({ error: 'Meeting not found' }); return; }
    await syncMeeting(orgId, existing.id);
    const fresh = await prisma.meeting.findUnique({ where: { id: existing.id } });
    res.json(fresh);
  } catch (err) { next(err); }
});

// DELETE /api/meetings/:id — soft-archive
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const existing = await prisma.meeting.findFirst({ where: { id: req.params.id, orgId, archivedAt: null }, select: { id: true } });
    if (!existing) { res.status(404).json({ error: 'Meeting not found' }); return; }
    await prisma.meeting.update({ where: { id: existing.id }, data: { archivedAt: new Date() } });
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
