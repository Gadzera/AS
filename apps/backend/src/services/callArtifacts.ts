/**
 * Call Intelligence — after-call артефакты + привязка к записям + favorites (M19-2, S317–S319).
 *
 * finalize: из транскрипта генерит summary + chapters (тематические; startSec=null без таймкодов) +
 * speaker stats (ТОЛЬКО при speaker-labeled транскрипте; иначе honest unavailable) + info. Платно
 * (1 кредит, source CALL_INSIGHT) и идемпотентно (call-finalize:<callId>:<transcriptHash>, no double-charge).
 * Транскрипт изменился → новый hash → артефакты «outdated» (detail сравнивает artifactTranscriptHash).
 * Привязка к CRM-записям: auto-link по email участников → Person → Company; Activity CALL_RECORDED
 * на связанных записях (dedupe по callId+objectKey+recordId). Favorites — PUT/DELETE (идемпотентно).
 */

import { ActivityType, AttributeType, Prisma, PrismaClient } from '@prisma/client';
import { assertCredits, debitCredits } from './billing/ledger';
import { llmComplete, llmAvailable, llmProvider } from './llm';
import { normalizeTranscript, transcriptHash, CallInsightError } from './callInsights';

const prisma = new PrismaClient();
const FINALIZE_COST = 1;

// ── Парсинг спикеров из «Speaker: text» ──
type SpeakerAgg = { turns: number; chars: number; words: number };
// Префиксы заметок/структуры — НЕ спикеры (иначе «Note:/Summary:/Action item:» дают фейковую статистику).
const NON_SPEAKER_PREFIX = new Set(['note', 'notes', 'summary', 'action', 'action item', 'action items', 'agenda', 'next steps', 'next step', 'risk', 'risks', 'todo', 'to do', 'objection', 'objections', 'recap', 'follow up', 'follow-up', 'http', 'https', 'www']);
function parseSpeakers(transcript: string): { labeled: boolean; speakers: Map<string, SpeakerAgg> } {
  const lines = transcript.split('\n');
  const re = /^([A-Za-z][A-Za-z0-9 .'_-]{0,40}?):\s*(\S.*)$/;
  const map = new Map<string, SpeakerAgg>();
  for (const line of lines) {
    const m = line.match(re);
    if (!m) continue;
    const speaker = m[1].trim();
    const text = m[2].trim();
    if (!speaker || !text) continue;
    if (NON_SPEAKER_PREFIX.has(speaker.toLowerCase())) continue; // отсекаем note-строки
    const a = map.get(speaker) ?? { turns: 0, chars: 0, words: 0 };
    a.turns += 1; a.chars += text.length; a.words += text.split(/\s+/).filter(Boolean).length;
    map.set(speaker, a);
  }
  // Реальный диалог = ≥2 спикера, КАЖДЫЙ повторяется (turns≥2). Одиночные colon-строки → НЕ спикеры.
  const recurring = new Map([...map.entries()].filter(([, a]) => a.turns >= 2));
  const labeled = recurring.size >= 2;
  return { labeled, speakers: labeled ? recurring : new Map() };
}

function speakerStats(map: Map<string, SpeakerAgg>): { speaker: string; talkSec: number; turns: number; sharePct: number }[] {
  const totalChars = [...map.values()].reduce((s, a) => s + a.chars, 0) || 1;
  return [...map.entries()].map(([speaker, a]) => ({
    speaker,
    talkSec: Math.round(a.words / 2.5), // оценка из слов (нет аудио — честно из текста)
    turns: a.turns,
    sharePct: Math.round((a.chars / totalChars) * 100),
  })).sort((x, y) => y.sharePct - x.sharePct);
}

// ── Главы (ТЕМАТИЧЕСКИЕ). startSec ВСЕГДА null: заголовки берём из LLM/сегментов, надёжного
// сопоставления «тема→таймкод» нет (нет аудио), поэтому НЕ выдумываем время (адверс-ревью M3). ──
async function buildChapters(transcript: string): Promise<{ title: string; startSec: number | null; order: number }[]> {
  const lines = transcript.split('\n').filter((l) => l.trim());

  let titles: string[] = [];
  if (llmAvailable()) {
    try {
      const out = await llmComplete({
        system: 'You segment a sales call transcript into 3-6 thematic chapters. Reply as a STRICT JSON array of short chapter title strings in order (no markdown). Titles only, no timestamps.',
        prompt: `Transcript:\n${transcript}`,
        json: true, maxTokens: 300, temperature: 0.3,
      });
      const parsed = JSON.parse(out.replace(/^```json\s*|\s*```$/g, '')) as unknown;
      if (Array.isArray(parsed)) titles = parsed.slice(0, 6).map((t) => String(t).slice(0, 80)).filter(Boolean);
    } catch { /* demo fallback */ }
  }
  if (!titles.length) {
    // demo: тематические главы из сегментов транскрипта (по равным долям реплик)
    const turns = lines.filter((l) => /^[A-Za-z][\w .'-]{0,40}?:/.test(l));
    const base = turns.length ? turns : lines;
    const n = Math.min(5, Math.max(2, Math.ceil(base.length / 4)));
    const per = Math.ceil(base.length / n);
    for (let i = 0; i < n; i++) {
      const seg = base.slice(i * per, (i + 1) * per).join(' ');
      const snippet = seg.replace(/^[A-Za-z][\w .'-]{0,40}?:\s*/, '').split(/[.!?]/)[0].trim().slice(0, 60);
      titles.push(snippet || `Part ${i + 1}`);
    }
  }

  return titles.map((title, i) => ({ title, startSec: null, order: i }));
}

async function buildSummary(transcript: string, fallback: string): Promise<{ summary: string; generatedBy: string }> {
  if (!llmAvailable()) return { summary: fallback, generatedBy: 'demo' };
  try {
    const out = await llmComplete({
      system: 'You summarize a sales call transcript in 2-3 factual sentences. No markdown.',
      prompt: `Transcript:\n${transcript}`, maxTokens: 300, temperature: 0.3,
    });
    return { summary: String(out).trim().slice(0, 800), generatedBy: llmProvider() };
  } catch { return { summary: fallback, generatedBy: 'demo' }; }
}

// ── finalize ──
export type CallArtifacts = {
  summary: string | null;
  chapters: { id: string; title: string; startSec: number | null; order: number }[];
  speakerStats: { speaker: string; talkSec: number; turns: number; sharePct: number }[];
  speakerLabeled: boolean;
  info: { durationSec: number; provider: string; participants: number; date: string | null };
  finalizedAt: string | null;
  outdated: boolean; // транскрипт изменился после finalize
  generatedBy: string;
};

export async function finalizeCall(orgId: string, callId: string, userId: string): Promise<CallArtifacts> {
  const call = await prisma.call.findFirst({ where: { id: callId, orgId, archivedAt: null } });
  if (!call) throw new CallInsightError('CALL_NOT_FOUND', 'Call not found', 404);
  if (!call.transcript || !call.transcript.trim()) throw new CallInsightError('NO_TRANSCRIPT', 'Add a transcript before finalizing', 409);

  const normalized = normalizeTranscript(call.transcript);
  const hash = transcriptHash(call.transcript);

  // идемпотентно: уже финализирован по ЭТОМУ транскрипту → вернуть как есть, без пересчёта/списания
  if (call.finalizedAt && call.artifactTranscriptHash === hash) {
    return loadArtifacts(orgId, callId);
  }

  // кредит ДО LLM (402 без работы); idempotencyKey по hash → повтор не спишет дважды
  await assertCredits(orgId, FINALIZE_COST, 'CALL_INSIGHT');

  const { labeled, speakers } = parseSpeakers(normalized);
  const stats = labeled ? speakerStats(speakers) : [];
  const chapters = await buildChapters(normalized);
  const fallbackSummary = `Call summary: ${normalized.replace(/\s+/g, ' ').slice(0, 200)}`;
  const { summary, generatedBy } = await buildSummary(normalized, fallbackSummary);
  const participantCount = await prisma.callParticipant.count({ where: { orgId, callId } });
  const info = { durationSec: call.durationSec, provider: call.recordingProvider ?? 'manual / demo upload', participants: participantCount, date: (call.scheduledAt ?? call.createdAt).toISOString() };

  // Адверс-ревью C1: артефакты persist'им ПЕРВЫМИ (без finalizedAt), потом списываем, потом метим finalizedAt.
  // Сбой persist → списания НЕ было; сбой debit → не finalized, ретрай спишет ровно раз (без free-finalize);
  // debit идемпотентен по ключу → ретрай после успешного списания не спишет дважды.
  await prisma.$transaction(async (tx) => {
    await tx.callChapter.deleteMany({ where: { orgId, callId } });
    await tx.callSpeakerStat.deleteMany({ where: { orgId, callId } });
    if (chapters.length) await tx.callChapter.createMany({ data: chapters.map((c) => ({ orgId, callId, title: c.title, startSec: c.startSec, order: c.order })) });
    if (stats.length) await tx.callSpeakerStat.createMany({ data: stats.map((s) => ({ orgId, callId, speaker: s.speaker, talkSec: s.talkSec, turns: s.turns, sharePct: s.sharePct })) });
  });
  await debitCredits({ orgId, amount: FINALIZE_COST, source: 'CALL_INSIGHT', idempotencyKey: `call-finalize:${callId}:${hash}`, reason: 'call finalize', userId, metadata: { callId } });
  await prisma.call.update({ where: { id: callId }, data: { finalizedAt: new Date(), artifactTranscriptHash: hash, speakerLabeled: labeled, summary, callInfo: info as Prisma.InputJsonValue } });

  return { ...(await loadArtifacts(orgId, callId)), generatedBy };
}

export async function loadArtifacts(orgId: string, callId: string): Promise<CallArtifacts> {
  const call = await prisma.call.findFirst({ where: { id: callId, orgId, archivedAt: null }, select: { transcript: true, summary: true, finalizedAt: true, artifactTranscriptHash: true, speakerLabeled: true, callInfo: true, durationSec: true, recordingProvider: true, scheduledAt: true, createdAt: true } });
  if (!call) throw new CallInsightError('CALL_NOT_FOUND', 'Call not found', 404);
  const [chapters, stats, participantCount] = await Promise.all([
    prisma.callChapter.findMany({ where: { orgId, callId }, orderBy: { order: 'asc' } }),
    prisma.callSpeakerStat.findMany({ where: { orgId, callId }, orderBy: { sharePct: 'desc' } }),
    prisma.callParticipant.count({ where: { orgId, callId } }),
  ]);
  const currentHash = call.transcript ? transcriptHash(call.transcript) : null;
  const outdated = !!call.finalizedAt && !!currentHash && call.artifactTranscriptHash !== currentHash;
  const info = (call.callInfo as CallArtifacts['info'] | null) ?? { durationSec: call.durationSec, provider: call.recordingProvider ?? 'manual / demo upload', participants: participantCount, date: (call.scheduledAt ?? call.createdAt).toISOString() };
  return {
    summary: call.summary,
    chapters: chapters.map((c) => ({ id: c.id, title: c.title, startSec: c.startSec, order: c.order })),
    speakerStats: stats.map((s) => ({ speaker: s.speaker, talkSec: s.talkSec, turns: s.turns, sharePct: s.sharePct })),
    speakerLabeled: call.speakerLabeled,
    info,
    finalizedAt: call.finalizedAt ? call.finalizedAt.toISOString() : null,
    outdated,
    generatedBy: 'persisted',
  };
}

// ── Привязка к CRM-записям ──
async function findPersonByEmail(orgId: string, email: string): Promise<{ recordId: string; objectKey: string } | null> {
  // адверс-ревью m1: НЕ угадываем при неоднозначности — берём 2 матча, если разные записи → pending (null)
  const vs = await prisma.value.findMany({
    where: { orgId, textValue: { equals: email, mode: 'insensitive' }, attribute: { type: AttributeType.EMAIL } },
    select: { record: { select: { id: true, archivedAt: true, object: { select: { key: true } } } } },
    take: 5,
  });
  const recs = vs.map((v) => v.record).filter((r): r is NonNullable<typeof r> => !!r && r.archivedAt === null);
  const distinct = [...new Map(recs.map((r) => [r.id, r])).values()];
  if (distinct.length !== 1) return null; // нет однозначного match
  return { recordId: distinct[0].id, objectKey: distinct[0].object.key };
}

// Компания персоны — ТОЛЬКО связь на объект companies (адверс-ревью M1: не линкуем deal/другую персону как «компанию»).
async function findCompanyOfPerson(orgId: string, personRecordId: string): Promise<{ recordId: string; objectKey: string } | null> {
  const rels = await prisma.relationshipValue.findMany({
    where: { orgId, sourceRecordId: personRecordId },
    select: { targetRecord: { select: { id: true, archivedAt: true, object: { select: { key: true } } } } },
    take: 20,
  });
  const company = rels.map((r) => r.targetRecord).find((t) => t && t.archivedAt === null && t.object.key === 'companies');
  if (!company) return null;
  return { recordId: company.id, objectKey: company.object.key };
}

export async function associateRecord(orgId: string, callId: string, objectKey: string, recordId: string, type: 'auto' | 'manual', userId: string): Promise<boolean> {
  // запись должна существовать в org
  const rec = await prisma.record.findFirst({ where: { id: recordId, orgId, archivedAt: null }, select: { id: true } });
  if (!rec) throw new CallInsightError('RECORD_NOT_FOUND', 'Record not found', 404);
  try {
    await prisma.callAssociatedRecord.create({ data: { orgId, callId, objectKey, recordId, associationType: type, createdById: userId } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return false; // уже связано
    throw e;
  }
  // Activity CALL_RECORDED — dedupe по (callId, objectKey, recordId)
  const dup = await prisma.activity.findFirst({ where: { orgId, recordId, type: ActivityType.CALL_RECORDED, payload: { path: ['callId'], equals: callId } }, select: { id: true } });
  if (!dup) {
    await prisma.activity.create({ data: { orgId, recordId, type: ActivityType.CALL_RECORDED, title: 'Call recorded', body: null, payload: { callId, objectKey } as Prisma.InputJsonValue, actorId: userId } });
  }
  return true;
}

// Если у звонка нет участников — берём контакт лида как участника (для auto-link демо/реальных кейсов).
export async function ensureParticipantsFromLead(orgId: string, callId: string): Promise<void> {
  const count = await prisma.callParticipant.count({ where: { orgId, callId } });
  if (count > 0) return;
  const call = await prisma.call.findFirst({ where: { id: callId, orgId }, select: { leadId: true } });
  if (!call?.leadId) return;
  const lead = await prisma.lead.findFirst({ where: { id: call.leadId, orgId }, select: { firstName: true, lastName: true, email: true } });
  if (!lead) return;
  await prisma.callParticipant.create({ data: { orgId, callId, name: `${lead.firstName} ${lead.lastName}`.trim(), email: lead.email ?? null } });
}

export async function autoLinkCall(orgId: string, callId: string, userId: string): Promise<{ linked: number; pending: number }> {
  await ensureParticipantsFromLead(orgId, callId);
  const participants = await prisma.callParticipant.findMany({ where: { orgId, callId, email: { not: null } } });
  let linked = 0; let pending = 0;
  for (const p of participants) {
    const person = p.email ? await findPersonByEmail(orgId, p.email) : null;
    if (!person) { pending++; continue; } // нет однозначного match → НЕ угадываем
    if (await associateRecord(orgId, callId, person.objectKey, person.recordId, 'auto', userId)) linked++;
    await prisma.callParticipant.update({ where: { id: p.id }, data: { recordId: person.recordId } });
    const company = await findCompanyOfPerson(orgId, person.recordId);
    if (company) { if (await associateRecord(orgId, callId, company.objectKey, company.recordId, 'auto', userId)) linked++; }
  }
  return { linked, pending };
}

export async function unassociateRecord(orgId: string, callId: string, objectKey: string, recordId: string): Promise<void> {
  await prisma.callAssociatedRecord.deleteMany({ where: { orgId, callId, objectKey, recordId } });
  // убрать событие из timeline записи (звонок при этом НЕ удаляется)
  const acts = await prisma.activity.findMany({ where: { orgId, recordId, type: ActivityType.CALL_RECORDED, payload: { path: ['callId'], equals: callId } }, select: { id: true } });
  if (acts.length) await prisma.activity.deleteMany({ where: { id: { in: acts.map((a) => a.id) } } });
}

export async function listAssociatedRecords(orgId: string, callId: string): Promise<{ id: string; objectKey: string; recordId: string; displayName: string | null; associationType: string }[]> {
  const links = await prisma.callAssociatedRecord.findMany({ where: { orgId, callId }, orderBy: { createdAt: 'asc' } });
  const recs = await prisma.record.findMany({ where: { id: { in: links.map((l) => l.recordId) }, orgId }, select: { id: true, displayName: true } });
  const nameMap = new Map(recs.map((r) => [r.id, r.displayName]));
  return links.map((l) => ({ id: l.id, objectKey: l.objectKey, recordId: l.recordId, displayName: nameMap.get(l.recordId) ?? null, associationType: l.associationType }));
}

// ── Favorites (PUT set / DELETE remove) ──
export async function setFavorite(orgId: string, callId: string, userId: string): Promise<void> {
  try { await prisma.callFavorite.create({ data: { orgId, callId, userId } }); }
  catch (e) { if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e; } // уже в избранном
}
export async function removeFavorite(orgId: string, callId: string, userId: string): Promise<void> {
  await prisma.callFavorite.deleteMany({ where: { orgId, callId, userId } });
}
