/**
 * Calls (звонки). Запись о звонке реальная (CRUD, статусы, исходы), AI-сводка разговора (DeepSeek).
 * Исход звонка наблюдаемо меняет состояние: статус лида, а MEETING_BOOKED создаёт встречу и
 * триггерит Workflow (MEETING_BOOKED). Сам набор номера — демо до подключения телефонии.
 *  GET /api/calls · POST /api/calls · PATCH /api/calls/:id · POST /api/calls/:id/summarize · DELETE /api/calls/:id
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient, CallStatus, CallDirection, CallOutcome } from '@prisma/client';
import { authenticate, requireOrg } from '../middleware/auth';
import { runWorkflows } from '../services/workflows';
import { syncMeeting } from '../services/calendar';
import { llmComplete, llmAvailable, llmProvider } from '../services/llm';
import { CallInsightError, TRANSCRIPT_CAP, runTemplateOnCall } from '../services/callInsights';
import { InsufficientCreditsError } from '../services/ai/credits';
import { finalizeCall, loadArtifacts, listAssociatedRecords, associateRecord, autoLinkCall, unassociateRecord, setFavorite, removeFavorite } from '../services/callArtifacts';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate, requireOrg);

// Исход звонка → новый статус лида (наблюдаемое изменение состояния).
const leadStatusByOutcome: Partial<Record<CallOutcome, 'CONTACTED' | 'HOT' | 'LOST' | 'REPLIED'>> = {
  CONNECTED: 'CONTACTED',
  MEETING_BOOKED: 'HOT',
  NOT_INTERESTED: 'LOST',
  CALLBACK: 'CONTACTED',
};

async function attachLeads<T extends { leadId: string | null }>(orgId: string, rows: T[]): Promise<(T & { lead: { id: string; name: string; company: string | null } | null })[]> {
  const ids = [...new Set(rows.map((r) => r.leadId).filter(Boolean) as string[])];
  const leads = ids.length ? await prisma.lead.findMany({ where: { id: { in: ids }, orgId }, select: { id: true, firstName: true, lastName: true, company: true } }) : [];
  const map = new Map(leads.map((l) => [l.id, { id: l.id, name: `${l.firstName} ${l.lastName}`, company: l.company }]));
  return rows.map((r) => ({ ...r, lead: r.leadId ? map.get(r.leadId) ?? null : null }));
}

// GET /api/calls?status=&recordId=&favorite=&mine=
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const recordId = typeof req.query.recordId === 'string' && req.query.recordId ? req.query.recordId : undefined;
    const favoriteOnly = req.query.favorite === 'true';
    const mineOnly = req.query.mine === 'true';

    // M19-2 фильтры: по связанной записи / по избранному / по своим звонкам
    let idFilter: string[] | undefined;
    if (recordId) {
      const links = await prisma.callAssociatedRecord.findMany({ where: { orgId, recordId }, select: { callId: true } });
      idFilter = [...new Set(links.map((l) => l.callId))];
    }
    if (favoriteOnly) {
      const favs = await prisma.callFavorite.findMany({ where: { orgId, userId }, select: { callId: true } });
      const favIds = new Set(favs.map((f) => f.callId));
      idFilter = idFilter ? idFilter.filter((id) => favIds.has(id)) : [...favIds];
    }

    const calls = await prisma.call.findMany({
      where: {
        orgId, archivedAt: null,
        ...(status ? { status: status as CallStatus } : {}),
        ...(mineOnly ? { createdById: userId } : {}),
        ...(idFilter ? { id: { in: idFilter.length ? idFilter : ['__none__'] } } : {}),
      },
      orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    });
    const favSet = new Set((await prisma.callFavorite.findMany({ where: { orgId, userId, callId: { in: calls.map((c) => c.id) } }, select: { callId: true } })).map((f) => f.callId));
    const withLeads = (await attachLeads(orgId, calls)).map((c) => ({ ...c, favorite: favSet.has(c.id) }));

    const [byStatus, byOutcome] = await Promise.all([
      prisma.call.groupBy({ by: ['status'], where: { orgId, archivedAt: null }, _count: { _all: true } }),
      prisma.call.groupBy({ by: ['outcome'], where: { orgId, archivedAt: null, outcome: { not: null } }, _count: { _all: true } }),
    ]);
    const counts: Record<string, number> = {};
    for (const g of byStatus) counts[g.status] = g._count._all;
    const outcomes: Record<string, number> = {};
    for (const g of byOutcome) if (g.outcome) outcomes[g.outcome] = g._count._all;

    const total = Object.values(counts).reduce((s, n) => s + n, 0);
    const connected = (outcomes.CONNECTED ?? 0) + (outcomes.MEETING_BOOKED ?? 0);
    const summary = {
      total,
      scheduled: counts.SCHEDULED ?? 0,
      completed: counts.COMPLETED ?? 0,
      connectRate: total > 0 ? Math.round((connected / total) * 100) : 0,
      meetingsBooked: outcomes.MEETING_BOOKED ?? 0,
    };
    res.json({ calls: withLeads, counts, outcomes, summary });
  } catch (err) { next(err); }
});

const createSchema = z.object({
  leadId: z.string().optional(),
  direction: z.nativeEnum(CallDirection).optional(),
  status: z.nativeEnum(CallStatus).optional(),
  outcome: z.nativeEnum(CallOutcome).nullable().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  durationSec: z.coerce.number().int().min(0).max(36000).optional(),
  notes: z.string().max(8000).optional(),
});

// POST /api/calls — запланировать или залогировать звонок.
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const data = createSchema.parse(req.body);
    const call = await prisma.call.create({
      data: {
        orgId,
        leadId: data.leadId ?? null,
        direction: data.direction ?? 'OUTBOUND',
        status: data.status ?? 'SCHEDULED',
        outcome: data.outcome ?? null,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        durationSec: data.durationSec ?? 0,
        notes: data.notes ?? null,
        createdById: req.user!.userId,
      },
    });
    const effects = await applyOutcomeEffects(orgId, call.id, call.leadId, call.outcome);
    const [withLead] = await attachLeads(orgId, [call]);
    res.status(201).json({ call: withLead, ...effects });
  } catch (err) { next(err); }
});

const updateSchema = z.object({
  status: z.nativeEnum(CallStatus).optional(),
  outcome: z.nativeEnum(CallOutcome).nullable().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  durationSec: z.coerce.number().int().min(0).max(36000).optional(),
  notes: z.string().max(8000).nullable().optional(),
});

// PATCH /api/calls/:id — обновить звонок; исход наблюдаемо меняет состояние лида/встречи/workflow.
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const existing = await prisma.call.findFirst({ where: { id: req.params.id, orgId, archivedAt: null } });
    if (!existing) { res.status(404).json({ error: 'Call not found' }); return; }
    const data = updateSchema.parse(req.body);

    const call = await prisma.call.update({
      where: { id: existing.id },
      data: {
        ...(data.status !== undefined && { status: data.status }),
        ...(data.outcome !== undefined && { outcome: data.outcome }),
        ...(data.scheduledAt !== undefined && { scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null }),
        ...(data.durationSec !== undefined && { durationSec: data.durationSec }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
    });

    // Эффекты исхода применяем, только если он ИЗМЕНИЛСЯ на этом PATCH (идемпотентность).
    let effects = {};
    if (data.outcome !== undefined && data.outcome !== existing.outcome) {
      effects = await applyOutcomeEffects(orgId, call.id, call.leadId, call.outcome);
    }
    const [withLead] = await attachLeads(orgId, [call]);
    res.json({ call: withLead, ...effects });
  } catch (err) { next(err); }
});

// POST /api/calls/:id/summarize — AI-сводка разговора + следующий шаг из заметок (DeepSeek).
router.post('/:id/summarize', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const call = await prisma.call.findFirst({ where: { id: req.params.id, orgId, archivedAt: null } });
    if (!call) { res.status(404).json({ error: 'Call not found' }); return; }
    if (!call.notes || call.notes.trim().length < 10) { res.status(400).json({ error: 'Add call notes first (min 10 chars) to summarize.' }); return; }

    const [withLead] = await attachLeads(orgId, [call]);
    const leadLabel = withLead.lead ? `${withLead.lead.name}${withLead.lead.company ? ` at ${withLead.lead.company}` : ''}` : 'the prospect';

    // grounded-demo по умолчанию (детерминированно из заметок/исхода)
    let summary = `Call with ${leadLabel}. ${call.notes.slice(0, 180)}`;
    let nextStep = call.outcome === 'MEETING_BOOKED' ? 'Send calendar invite and prep a tailored agenda.' : 'Follow up with a recap email and propose next steps.';
    let intent = call.outcome === 'MEETING_BOOKED' ? 'High — agreed to a meeting' : call.outcome === 'NOT_INTERESTED' ? 'Low — not interested right now' : call.outcome === 'CALLBACK' ? 'Medium — asked to reconnect later' : 'Unclear from notes';
    let objections: string[] = /\b(price|pricing|cost|budget|expensive)\b/i.test(call.notes) ? ['Pricing / budget'] : [];
    let risk = call.outcome === 'NOT_INTERESTED' ? 'Deal likely lost — needs a strong re-engagement reason.' : 'Momentum may stall without a fast, concrete follow-up.';
    let generatedBy = 'demo';

    if (llmAvailable()) {
      const out = await llmComplete({
        system: 'You are an AI SDR call-intelligence assistant. From raw sales-call notes, extract structured insights. Reply as STRICT JSON with keys: "summary" (2-3 factual sentences), "nextStep" (one concrete recommended action), "intent" (one short phrase on the prospect\'s buying intent/readiness), "objections" (array of short strings — concerns raised; [] if none), "risk" (one short phrase on the main risk to the deal). No markdown.',
        prompt: `Prospect: ${leadLabel}\nCall outcome: ${call.outcome ?? 'unknown'}\nRaw notes:\n${call.notes}`,
        json: true,
        maxTokens: 600,
        temperature: 0.4,
      });
      try {
        const parsed = JSON.parse(out.replace(/^```json\s*|\s*```$/g, '')) as { summary?: string; nextStep?: string; intent?: string; objections?: string[]; risk?: string };
        if (parsed.summary) summary = parsed.summary;
        if (parsed.nextStep) nextStep = parsed.nextStep;
        if (parsed.intent) intent = String(parsed.intent).slice(0, 120);
        if (Array.isArray(parsed.objections)) objections = parsed.objections.slice(0, 5).map((o) => String(o).slice(0, 80)).filter(Boolean);
        if (parsed.risk) risk = String(parsed.risk).slice(0, 160);
        generatedBy = llmProvider();
      } catch { /* оставляем grounded-demo */ }
    }

    const updated = await prisma.call.update({ where: { id: call.id }, data: { summary, nextStep, aiIntent: intent, aiObjections: objections, aiRisk: risk } });
    const [out] = await attachLeads(orgId, [updated]);
    res.json({ call: out, generatedBy });
  } catch (err) { next(err); }
});

// ── M19-1: транскрипт + прогон insight-шаблонов ──
const transcriptSchema = z.object({
  transcript: z.string().max(TRANSCRIPT_CAP),
  source: z.enum(['upload', 'paste', 'demo']).default('paste'),
});

// POST /api/calls/:id/transcript — загрузить/вставить транскрипт (demo — реального рекордера нет)
router.post('/:id/transcript', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const call = await prisma.call.findFirst({ where: { id: req.params.id, orgId, archivedAt: null }, select: { id: true } });
    if (!call) { res.status(404).json({ error: 'Call not found' }); return; }
    const data = transcriptSchema.parse(req.body);
    const updated = await prisma.call.update({ where: { id: call.id }, data: { transcript: data.transcript, transcriptSource: data.source } });
    res.json({ call: { id: updated.id, transcript: updated.transcript, transcriptSource: updated.transcriptSource } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      // адверс-ревью M2: любое превышение лимита → честный 413 TRANSCRIPT_TOO_LONG (не глухой 400)
      if (err.issues.some((i) => i.path.includes('transcript') && i.code === 'too_big')) { res.status(413).json({ error: `Transcript exceeds ${TRANSCRIPT_CAP} characters`, code: 'TRANSCRIPT_TOO_LONG' }); return; }
      res.status(400).json({ error: 'Invalid transcript' }); return;
    }
    next(err);
  }
});

// POST /api/calls/:id/insights/run — применить шаблон к транскрипту звонка (платно, идемпотентно)
router.post('/:id/insights/run', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const templateId = typeof req.body?.templateId === 'string' ? req.body.templateId : '';
    if (!templateId) { res.status(400).json({ error: 'templateId is required', code: 'TEMPLATE_REQUIRED' }); return; }
    const force = req.body?.force === true;
    const clientRequestId = typeof req.body?.clientRequestId === 'string' && req.body.clientRequestId ? req.body.clientRequestId.slice(0, 120) : null;
    const out = await runTemplateOnCall({ orgId, userId: req.user!.userId, role: req.user!.role, callId: req.params.id, templateId, force, clientRequestId });
    res.json(out);
  } catch (err) {
    if (err instanceof CallInsightError) { res.status(err.statusCode).json({ error: err.message, code: err.code }); return; }
    if (err instanceof InsufficientCreditsError) { res.status(402).json({ error: 'Not enough AI credits', code: 'INSUFFICIENT_CREDITS' }); return; }
    next(err);
  }
});

// GET /api/calls/:id/insights — история прогонов (ракурсы), latest per template сверху
router.get('/:id/insights', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const call = await prisma.call.findFirst({ where: { id: req.params.id, orgId, archivedAt: null }, select: { id: true } });
    if (!call) { res.status(404).json({ error: 'Call not found' }); return; }
    const runs = await prisma.callInsightRun.findMany({ where: { orgId, callId: call.id }, orderBy: { createdAt: 'desc' }, take: 50 });
    res.json({ runs: runs.map((r) => ({ id: r.id, callId: r.callId, templateId: r.templateId, templateName: r.templateName, templateVersion: r.templateVersion, results: r.results, creditsCharged: r.creditsCharged, generatedBy: r.generatedBy, createdAt: r.createdAt })) });
  } catch (err) { next(err); }
});

// ── M19-2: after-call артефакты + привязка к записям + favorites ──
const handleCallErr = (err: unknown, res: Response, next: NextFunction): void => {
  if (err instanceof CallInsightError) { res.status(err.statusCode).json({ error: err.message, code: err.code }); return; }
  if (err instanceof InsufficientCreditsError) { res.status(402).json({ error: 'Not enough AI credits', code: 'INSUFFICIENT_CREDITS' }); return; }
  next(err);
};

// POST /:id/finalize — построить summary/chapters/speaker-stats/info из транскрипта (платно, идемпотентно)
router.post('/:id/finalize', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ artifacts: await finalizeCall(req.user!.orgId!, req.params.id, req.user!.userId) }); }
  catch (err) { handleCallErr(err, res, next); }
});

// GET /:id/artifacts — артефакты + связанные записи + участники + статус favorite
router.get('/:id/artifacts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const call = await prisma.call.findFirst({ where: { id: req.params.id, orgId, archivedAt: null }, select: { id: true } });
    if (!call) { res.status(404).json({ error: 'Call not found' }); return; }
    const [artifacts, associated, participants, fav] = await Promise.all([
      loadArtifacts(orgId, call.id),
      listAssociatedRecords(orgId, call.id),
      prisma.callParticipant.findMany({ where: { orgId, callId: call.id }, select: { id: true, name: true, email: true, recordId: true } }),
      prisma.callFavorite.findFirst({ where: { orgId, callId: call.id, userId: req.user!.userId }, select: { id: true } }),
    ]);
    res.json({ artifacts, associatedRecords: associated, participants, favorite: !!fav });
  } catch (err) { handleCallErr(err, res, next); }
});

// POST /:id/participants — добавить участника
router.post('/:id/participants', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const call = await prisma.call.findFirst({ where: { id: req.params.id, orgId, archivedAt: null }, select: { id: true } });
    if (!call) { res.status(404).json({ error: 'Call not found' }); return; }
    const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 120) : '';
    const email = typeof req.body?.email === 'string' && req.body.email.trim() ? req.body.email.trim().slice(0, 200) : null;
    if (!name) { res.status(400).json({ error: 'name is required' }); return; }
    const p = await prisma.callParticipant.create({ data: { orgId, callId: call.id, name, email } });
    res.status(201).json({ participant: { id: p.id, name: p.name, email: p.email, recordId: p.recordId } });
  } catch (err) { next(err); }
});

// POST /:id/records — привязать запись вручную {recordId, objectKey} ИЛИ авто {autoLink:true}
router.post('/:id/records', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const call = await prisma.call.findFirst({ where: { id: req.params.id, orgId, archivedAt: null }, select: { id: true } });
    if (!call) { res.status(404).json({ error: 'Call not found' }); return; }
    if (req.body?.autoLink === true) {
      const r = await autoLinkCall(orgId, call.id, req.user!.userId);
      res.json({ ...r, associatedRecords: await listAssociatedRecords(orgId, call.id) });
      return;
    }
    const recordId = typeof req.body?.recordId === 'string' ? req.body.recordId : '';
    const objectKey = typeof req.body?.objectKey === 'string' ? req.body.objectKey : '';
    if (!recordId || !objectKey) { res.status(400).json({ error: 'recordId and objectKey are required' }); return; }
    await associateRecord(orgId, call.id, objectKey, recordId, 'manual', req.user!.userId);
    res.status(201).json({ associatedRecords: await listAssociatedRecords(orgId, call.id) });
  } catch (err) { handleCallErr(err, res, next); }
});

// DELETE /:id/records/:recordId?objectKey= — отвязать (звонок НЕ удаляется)
router.delete('/:id/records/:recordId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const objectKey = typeof req.query.objectKey === 'string' ? req.query.objectKey : '';
    if (!objectKey) { res.status(400).json({ error: 'objectKey query param is required' }); return; } // не молчаливый no-op
    await unassociateRecord(orgId, req.params.id, objectKey, req.params.recordId);
    res.json({ ok: true, associatedRecords: await listAssociatedRecords(orgId, req.params.id) });
  } catch (err) { handleCallErr(err, res, next); }
});

// PUT /:id/favorite — в избранное; DELETE — убрать (идемпотентно)
router.put('/:id/favorite', async (req: Request, res: Response, next: NextFunction) => {
  try { await setFavorite(req.user!.orgId!, req.params.id, req.user!.userId); res.json({ favorite: true }); }
  catch (err) { next(err); }
});
router.delete('/:id/favorite', async (req: Request, res: Response, next: NextFunction) => {
  try { await removeFavorite(req.user!.orgId!, req.params.id, req.user!.userId); res.json({ favorite: false }); }
  catch (err) { next(err); }
});

// DELETE /api/calls/:id — soft-archive
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const existing = await prisma.call.findFirst({ where: { id: req.params.id, orgId, archivedAt: null }, select: { id: true } });
    if (!existing) { res.status(404).json({ error: 'Call not found' }); return; }
    await prisma.call.update({ where: { id: existing.id }, data: { archivedAt: new Date() } });
    res.status(204).send();
  } catch (err) { next(err); }
});

// Применить эффекты исхода: статус лида + (для MEETING_BOOKED) создать встречу и триггерить Workflow.
async function applyOutcomeEffects(orgId: string, callId: string, leadId: string | null, outcome: CallOutcome | null): Promise<{ leadStatus?: string; meetingCreated?: boolean; workflowsTriggered?: number }> {
  if (!outcome || !leadId) return {};
  const result: { leadStatus?: string; meetingCreated?: boolean; workflowsTriggered?: number } = {};

  const newStatus = leadStatusByOutcome[outcome];
  if (newStatus) {
    await prisma.lead.updateMany({ where: { id: leadId, orgId }, data: { status: newStatus } });
    result.leadStatus = newStatus;
  }

  if (outcome === 'MEETING_BOOKED') {
    const lead = await prisma.lead.findFirst({ where: { id: leadId, orgId }, select: { firstName: true, lastName: true, company: true } });
    const meeting = await prisma.meeting.create({
      data: {
        orgId, leadId,
        title: `Call follow-up — ${lead ? `${lead.firstName} ${lead.lastName}` : 'prospect'}`,
        company: lead?.company ?? null,
        status: 'SCHEDULED',
        source: 'call',
        durationMin: 30,
      },
    });
    await syncMeeting(orgId, meeting.id); // календарная синхронизация встречи из звонка
    result.meetingCreated = true;
    // M11-1: scope стопа к кампании последнего исходящего касания лида.
    const lastOutbound = await prisma.message.findFirst({
      where: { leadId, direction: 'OUTBOUND', campaignId: { not: null } },
      orderBy: { sentAt: 'desc' },
      select: { campaignId: true },
    });
    // M17-2: стабильный ключ meeting:<meetingId> — одна встреча запускает правило ровно раз.
    const wf = await runWorkflows({ orgId, trigger: 'MEETING_BOOKED', leadId, campaignId: lastOutbound?.campaignId ?? null, idempotencyKey: `meeting:${meeting.id}` });
    result.workflowsTriggered = wf.matched;
  }

  return result;
}

export default router;
