/**
 * Bulk productivity actions (M28-4). Монтируется на /api/bulk.
 *   POST /send-email/preview — превью bulk-рассылки: per-record получатель, resolved subject/to, unresolved, skipped.
 *   POST /send-email          — demo-send per-record (resolved recipient), partial result succeeded/skipped/failed.
 *   POST /enroll-sequence     — enroll связанных People в кампанию (Lead-мост + CampaignLead dedup), partial result.
 *
 * Add to list — переиспользует УЖЕ принятый движок POST /api/lists/:id/entries (дедуп ListEntry, RBAC LIST READ_WRITE).
 *
 * Дисциплина (scope GPT):
 *  • surfaces: People/Deals table + list-entries (recordIds приходят из выделения);
 *  • per-item RBAC (OBJECT READ_WRITE на объект записи) — нет доступа → skipped, не падаем целиком;
 *  • Deals/custom НЕ шлём «на запись» — recipient резолвится через связанных People (recipientResolver); нет → skipped;
 *  • bulk send только осознанно: есть preview-эндпоинт (recipients/resolved/unresolved/skipped/demo-disclaimer);
 *  • dedup: enroll пропускает уже-enrolled; no-op НЕ пишет Activity;
 *  • demo-safe: письма demo=true, без внешней доставки.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Direction, EmailStatus, Channel, ActivityType, EnrollmentStatus, Prisma, PrismaClient } from '@prisma/client';
import { authenticate, requireOrg } from '../middleware/auth';
import { buildResolver, meets, AccessResolver } from '../services/permissions';
import { resolveRecipients } from '../services/crm/recipientResolver';
import { buildMergeContext, resolveMerge } from '../services/crm/mergeVariables';
import { audit } from '../services/audit';

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate, requireOrg);

const MAX_IDS = 200;
const PRESEND_DISCLAIMER = 'Demo-safe · no external delivery';

const sendPreviewSchema = z.object({
  recordIds: z.array(z.string().min(1)).min(1).max(MAX_IDS),
  templateId: z.string().trim().max(60).optional().nullable(),
  subject: z.string().max(500).optional().default(''),
  body: z.string().max(20000).optional().default(''),
});
const sendSchema = sendPreviewSchema.extend({ idempotencyKey: z.string().trim().min(1).max(200).optional().nullable() });
const enrollSchema = z.object({
  recordIds: z.array(z.string().min(1)).min(1).max(MAX_IDS),
  campaignId: z.string().min(1),
});

type RecordLite = { id: string; objectId: string; displayName: string | null; archived: boolean };

// Грузит выбранные записи org (id→meta), молча отбрасывая чужие/несуществующие (они попадут в not_found).
// Архив записи ИЛИ её объекта → archived (адверс MED: bulk не действует на записи мёртвого объекта).
async function loadRecords(orgId: string, ids: string[]): Promise<Map<string, RecordLite>> {
  const uniq = Array.from(new Set(ids));
  const recs = await prisma.record.findMany({ where: { orgId, id: { in: uniq } }, select: { id: true, objectId: true, displayName: true, archivedAt: true, object: { select: { archivedAt: true } } } });
  return new Map(recs.map((r) => [r.id, { id: r.id, objectId: r.objectId, displayName: r.displayName, archived: r.archivedAt !== null || r.object?.archivedAt != null }]));
}

// Первый резолвимый получатель записи (self для People, связанные People для Deals/custom) или null.
async function pickRecipient(orgId: string, recordId: string): Promise<{ email: string; name: string | null; recordId: string } | null> {
  const cands = await resolveRecipients(orgId, recordId);
  const c = cands[0];
  return c ? { email: c.email, name: c.displayName, recordId: c.recordId } : null;
}

// Общая per-record подготовка bulk-send: RBAC + archived + recipient + merge. Возвращает либо ok, либо skip-причину.
async function prepareSend(
  orgId: string, rec: RecordLite | undefined, recordId: string, resolve: AccessResolver,
  input: { subject: string; body: string }
): Promise<
  | { ok: true; recordId: string; recordName: string | null; to: string; recipientRecordId: string; subject: string; body: string; unresolved: string[]; empty: string[] }
  | { ok: false; recordId: string; recordName: string | null; reason: string }
> {
  if (!rec) return { ok: false, recordId, recordName: null, reason: 'not_found' };
  if (!meets(resolve(rec.objectId), 'READ_WRITE')) return { ok: false, recordId, recordName: rec.displayName, reason: 'no_access' };
  if (rec.archived) return { ok: false, recordId, recordName: rec.displayName, reason: 'archived' };
  const recipient = await pickRecipient(orgId, recordId);
  if (!recipient) return { ok: false, recordId, recordName: rec.displayName, reason: 'no_recipient' };
  const ctx = await buildMergeContext(orgId, recordId, { email: recipient.email, name: recipient.name });
  const s = resolveMerge(input.subject ?? '', ctx);
  const b = resolveMerge(input.body ?? '', ctx);
  const unresolved = Array.from(new Set([...s.unresolved, ...b.unresolved]));
  const empty = Array.from(new Set([...s.empty, ...b.empty]));
  return { ok: true, recordId, recordName: rec.displayName, to: recipient.email, recipientRecordId: recipient.recordId, subject: s.output, body: b.output, unresolved, empty };
}

async function checkTemplate(orgId: string, templateId: string | null | undefined): Promise<boolean> {
  if (!templateId) return true;
  const t = await prisma.emailTemplate.findFirst({ where: { id: templateId, orgId, archivedAt: null }, select: { id: true } });
  return t != null;
}

// POST /send-email/preview — превью без отправки.
router.post('/send-email/preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const data = sendPreviewSchema.parse(req.body);
    if (!(await checkTemplate(orgId, data.templateId))) { res.status(400).json({ error: 'Template not found or archived', code: 'TEMPLATE_NOT_FOUND' }); return; }
    const recsMap = await loadRecords(orgId, data.recordIds);
    const resolve = await buildResolver(orgId, { userId: req.user!.userId, role: req.user!.role }, 'OBJECT');

    const items = [] as any[];
    let ready = 0, skipped = 0;
    for (const id of data.recordIds) {
      const prep = await prepareSend(orgId, recsMap.get(id), id, resolve, data);
      if (!prep.ok) { skipped += 1; items.push({ recordId: id, recordName: prep.recordName, status: 'skipped', reason: prep.reason }); continue; }
      const willSend = prep.unresolved.length === 0;
      if (willSend) ready += 1; else skipped += 1;
      items.push({ recordId: id, recordName: prep.recordName, status: willSend ? 'ready' : 'skipped', reason: willSend ? undefined : 'unresolved_variables', to: prep.to, subject: prep.subject, snippet: prep.body.slice(0, 140), unresolved: prep.unresolved, empty: prep.empty });
    }
    res.json({ items, summary: { ready, skipped, total: data.recordIds.length }, demo: true, disclaimer: PRESEND_DISCLAIMER });
  } catch (err) { next(err); }
});

// POST /send-email — demo-send per-record.
router.post('/send-email', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const data = sendSchema.parse(req.body);
    if (!(await checkTemplate(orgId, data.templateId))) { res.status(400).json({ error: 'Template not found or archived', code: 'TEMPLATE_NOT_FOUND' }); return; }
    const recsMap = await loadRecords(orgId, data.recordIds);
    const resolve = await buildResolver(orgId, { userId: req.user!.userId, role: req.user!.role }, 'OBJECT');
    const actor = await prisma.user.findFirst({ where: { id: req.user!.userId }, select: { email: true, name: true } });

    const results = [] as { recordId: string; status: 'succeeded' | 'skipped' | 'failed'; reason?: string; emailId?: string }[];
    let succeeded = 0, skipped = 0, failed = 0;
    for (const id of data.recordIds) {
      const prep = await prepareSend(orgId, recsMap.get(id), id, resolve, data);
      if (!prep.ok) { skipped += 1; results.push({ recordId: id, status: 'skipped', reason: prep.reason }); continue; }
      if (prep.unresolved.length > 0) { skipped += 1; results.push({ recordId: id, status: 'skipped', reason: 'unresolved_variables' }); continue; }
      if (!prep.subject.trim() && !prep.body.trim()) { skipped += 1; results.push({ recordId: id, status: 'skipped', reason: 'empty' }); continue; }
      const storedKey = data.idempotencyKey ? `bulk:${data.idempotencyKey}:${id}` : null;
      try {
        const email = await prisma.$transaction(async (tx) => {
          if (storedKey) {
            const existing = await tx.email.findFirst({ where: { orgId, recordId: id, idempotencyKey: storedKey }, select: { id: true } });
            if (existing) return existing; // идемпотентно: повтор bulk не плодит дубль
          }
          const e = await tx.email.create({
            data: {
              orgId, recordId: id, senderUserId: req.user!.userId, direction: Direction.OUTBOUND, channel: Channel.EMAIL,
              status: EmailStatus.SENT, fromEmail: actor?.email ?? null, fromName: actor?.name ?? null,
              toEmails: [prep.to] as Prisma.InputJsonValue, subject: prep.subject || null, bodyText: prep.body || null,
              demo: true, templateId: data.templateId ?? null, idempotencyKey: storedKey, sentAt: new Date(),
            }, select: { id: true },
          });
          // Activity ровно на РЕАЛЬНО созданное письмо (no-op idempotent-возврат сюда не доходит)
          await tx.activity.create({ data: { orgId, recordId: id, actorId: req.user!.userId, emailId: e.id, type: ActivityType.EMAIL_SENT, title: 'Email sent (demo, bulk)', payload: { to: prep.to, demo: true, bulk: true } as Prisma.InputJsonValue } });
          return e;
        });
        succeeded += 1; results.push({ recordId: id, status: 'succeeded', emailId: email.id });
      } catch (e) {
        // гонка bulk-дубля по storedKey → считаем как succeeded (письмо уже есть), без второго Activity
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && storedKey) {
          const ex = await prisma.email.findFirst({ where: { orgId, recordId: id, idempotencyKey: storedKey }, select: { id: true } });
          if (ex) { succeeded += 1; results.push({ recordId: id, status: 'succeeded', emailId: ex.id }); continue; }
        }
        failed += 1; results.push({ recordId: id, status: 'failed', reason: 'send_error' });
      }
    }
    // audit только при реальном эффекте (адверс: пустой no-op батч не шумит в audit log)
    if (succeeded + failed > 0) await audit({ orgId, actorId: req.user!.userId, action: 'BULK_EMAIL_SENT', targetType: 'email', summary: `bulk demo-send: ${succeeded} sent, ${skipped} skipped, ${failed} failed` });
    res.json({ results, summary: { succeeded, skipped, failed, total: data.recordIds.length }, demo: true, disclaimer: PRESEND_DISCLAIMER });
  } catch (err) { next(err); }
});

// POST /enroll-sequence — enroll связанных People в кампанию (Lead-мост + CampaignLead dedup).
router.post('/enroll-sequence', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const data = enrollSchema.parse(req.body);
    const campaign = await prisma.campaign.findFirst({ where: { id: data.campaignId, orgId }, select: { id: true, name: true } });
    if (!campaign) { res.status(404).json({ error: 'Campaign not found', code: 'CAMPAIGN_NOT_FOUND' }); return; }
    const recsMap = await loadRecords(orgId, data.recordIds);
    const resolve = await buildResolver(orgId, { userId: req.user!.userId, role: req.user!.role }, 'OBJECT');

    const results = [] as { recordId: string; status: 'succeeded' | 'skipped' | 'failed'; reason?: string }[];
    let succeeded = 0, skipped = 0, failed = 0;
    for (const id of data.recordIds) {
      const rec = recsMap.get(id);
      if (!rec) { skipped += 1; results.push({ recordId: id, status: 'skipped', reason: 'not_found' }); continue; }
      if (!meets(resolve(rec.objectId), 'READ_WRITE')) { skipped += 1; results.push({ recordId: id, status: 'skipped', reason: 'no_access' }); continue; }
      if (rec.archived) { skipped += 1; results.push({ recordId: id, status: 'skipped', reason: 'archived' }); continue; }
      const recipient = await pickRecipient(orgId, id);
      if (!recipient) { skipped += 1; results.push({ recordId: id, status: 'skipped', reason: 'no_recipient' }); continue; }
      try {
        // Lead-мост (race-safe, вне tx): upsert по @@unique([orgId,email]) — параллельный bulk не плодит дубль Lead.
        const email = recipient.email;
        const parts = (recipient.name || email).trim().split(/\s+/);
        const firstName = parts[0] || email;
        const lastName = parts.slice(1).join(' ') || '—';
        const lead = await prisma.lead.upsert({
          where: { orgId_email: { orgId, email } },
          create: { orgId, firstName, lastName, email },
          update: {},
          select: { id: true },
        });
        // dedup enrollment + Activity в одной транзакции (CampaignLead @@unique = последний барьер от двойного enroll)
        const outcome = await prisma.$transaction(async (tx) => {
          const existing = await tx.campaignLead.findUnique({ where: { campaignId_leadId: { campaignId: campaign.id, leadId: lead.id } }, select: { id: true } });
          if (existing) return 'already_enrolled' as const;
          await tx.campaignLead.create({ data: { campaignId: campaign.id, leadId: lead.id, status: EnrollmentStatus.PENDING, currentStep: 0 } });
          await tx.activity.create({ data: { orgId, recordId: id, actorId: req.user!.userId, type: ActivityType.SEQUENCE_ENROLLED, title: `Enrolled in ${campaign.name}`, payload: { campaignId: campaign.id, leadEmail: email } as Prisma.InputJsonValue } });
          return 'enrolled' as const;
        });
        if (outcome === 'enrolled') { succeeded += 1; results.push({ recordId: id, status: 'succeeded' }); }
        else { skipped += 1; results.push({ recordId: id, status: 'skipped', reason: 'already_enrolled' }); }
      } catch (e) {
        // гонка одновременного enroll того же lead → CampaignLead P2002 → считаем как already_enrolled (дубля нет)
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') { skipped += 1; results.push({ recordId: id, status: 'skipped', reason: 'already_enrolled' }); }
        else { failed += 1; results.push({ recordId: id, status: 'failed', reason: 'enroll_error' }); }
      }
    }
    if (succeeded + failed > 0) await audit({ orgId, actorId: req.user!.userId, action: 'BULK_SEQUENCE_ENROLL', targetType: 'campaign', targetId: campaign.id, summary: `bulk enroll into ${campaign.name}: ${succeeded} enrolled, ${skipped} skipped, ${failed} failed` });
    res.json({ results, summary: { succeeded, skipped, failed, total: data.recordIds.length } });
  } catch (err) { next(err); }
});

export default router;
