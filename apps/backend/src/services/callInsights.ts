/**
 * Call Intelligence — insight-шаблоны и их прогон над транскриптом звонка (M19-1, S313–S315/S322).
 *
 * Шаблон = упорядоченный набор секций {title, prompt, формат text|bullets}. Применяется к транскрипту:
 * AI генерит структурированный результат по секциям (DeepSeek + детерминированный demo-fallback).
 * Прогон ПЛАТНЫЙ (1 кредит/секцию, source CALL_INSIGHT) и ИДЕМПОТЕНТНЫЙ: ключ включает templateVersion
 * и нормализованный transcriptHash — правка секции (version++) или другой транскрипт → новый платный run,
 * тот же — возвращается существующий без повторного списания.
 */

import { createHash } from 'crypto';
import { InsightOutputFormat, InsightTemplateScope, Prisma, PrismaClient } from '@prisma/client';
import { assertCredits, debitCredits } from './billing/ledger';
import { llmComplete, llmAvailable, llmProvider } from './llm';

const prisma = new PrismaClient();

export const MAX_SECTIONS = 20;
export const PROMPT_CAP = 2000;
export const TRANSCRIPT_CAP = 60000; // символов; больше → честный TRANSCRIPT_TOO_LONG (cap, не chunking в M19-1)
export const CREDIT_PER_SECTION = 1;

export class CallInsightError extends Error {
  statusCode: number;
  code: string;
  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = 'CallInsightError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

// ── Нормализация + хеш транскрипта (CRLF→LF, trim, collapse trailing spaces) ──
export function normalizeTranscript(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n') // CRLF/CR → LF
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, '')) // trailing spaces/tabs
    .join('\n')
    .trim();
}
export function transcriptHash(raw: string): string {
  return createHash('sha1').update(normalizeTranscript(raw)).digest('hex');
}

// ── Видимость шаблонов ──
type Role = string;
function isManager(role: Role): boolean { return role === 'OWNER' || role === 'ADMIN'; }

// Видимые пользователю шаблоны: system + WORKSPACE + свои PERSONAL; manager видит ВСЕ (чужие personal — read-only).
export function visibleTemplatesWhere(orgId: string, userId: string, role: Role): Prisma.InsightTemplateWhereInput {
  if (isManager(role)) return { orgId, archivedAt: null };
  return {
    orgId,
    archivedAt: null,
    OR: [
      { isSystem: true },
      { scope: InsightTemplateScope.WORKSPACE },
      { scope: InsightTemplateScope.PERSONAL, ownerId: userId },
    ],
  };
}

export function canEditTemplate(t: { isSystem: boolean; scope: InsightTemplateScope; ownerId: string | null }, userId: string, role: Role): boolean {
  if (t.isSystem) return false; // SYSTEM_TEMPLATE_IMMUTABLE
  if (t.scope === InsightTemplateScope.PERSONAL) return t.ownerId === userId;
  return isManager(role); // WORKSPACE → manager-only
}

// ── Валидация ──
export type SectionInput = { title: string; prompt: string; outputFormat: InsightOutputFormat; order?: number };
export function validateSections(sections: SectionInput[]): void {
  if (!Array.isArray(sections) || sections.length < 1) throw new CallInsightError('TEMPLATE_NO_SECTIONS', 'A template needs at least one section');
  if (sections.length > MAX_SECTIONS) throw new CallInsightError('TEMPLATE_TOO_MANY_SECTIONS', `A template can have at most ${MAX_SECTIONS} sections`);
  const titles = new Set<string>();
  for (const s of sections) {
    const title = (s.title ?? '').trim();
    const prompt = (s.prompt ?? '').trim();
    if (!title) throw new CallInsightError('EMPTY_SECTION_TITLE', 'Each section needs a title');
    if (!prompt) throw new CallInsightError('EMPTY_PROMPT', `Section "${title}" needs a prompt`);
    if (prompt.length > PROMPT_CAP) throw new CallInsightError('PROMPT_TOO_LONG', `Section "${title}" prompt exceeds ${PROMPT_CAP} characters`);
    if (s.outputFormat !== InsightOutputFormat.TEXT && s.outputFormat !== InsightOutputFormat.BULLETS) throw new CallInsightError('UNSUPPORTED_FORMAT', 'Output format must be TEXT or BULLETS');
    const key = title.toLowerCase();
    if (titles.has(key)) throw new CallInsightError('DUPLICATE_SECTION', `Duplicate section title "${title}"`);
    titles.add(key);
  }
}

// ── Системные шаблоны (seeded, immutable) ──
const SYSTEM_TEMPLATES: { name: string; description: string; sections: SectionInput[] }[] = [
  {
    name: 'Sales discovery',
    description: 'Qualify the prospect from a discovery call.',
    sections: [
      { title: 'Current tool', prompt: 'What tool or solution does the prospect currently use for this problem? Quote specifics if mentioned.', outputFormat: InsightOutputFormat.TEXT, order: 0 },
      { title: 'Needed features', prompt: 'List the capabilities or features the prospect said they need.', outputFormat: InsightOutputFormat.BULLETS, order: 1 },
      { title: 'Budget', prompt: 'Summarize anything said about budget, pricing expectations or procurement.', outputFormat: InsightOutputFormat.TEXT, order: 2 },
      { title: 'Timeline', prompt: 'When does the prospect want to decide or go live?', outputFormat: InsightOutputFormat.TEXT, order: 3 },
    ],
  },
  {
    name: 'Call handoff',
    description: 'Hand a call off to an account executive.',
    sections: [
      { title: 'Summary', prompt: 'Summarize the call in 2-3 factual sentences.', outputFormat: InsightOutputFormat.TEXT, order: 0 },
      { title: 'Objections', prompt: 'List the objections or concerns the prospect raised.', outputFormat: InsightOutputFormat.BULLETS, order: 1 },
      { title: 'Next steps', prompt: 'List the agreed or recommended next steps.', outputFormat: InsightOutputFormat.BULLETS, order: 2 },
    ],
  },
];

export async function ensureSystemTemplates(orgId: string): Promise<void> {
  for (const tpl of SYSTEM_TEMPLATES) {
    const existing = await prisma.insightTemplate.findFirst({ where: { orgId, isSystem: true, name: tpl.name }, select: { id: true } });
    if (existing) continue;
    try {
      await prisma.insightTemplate.create({
        data: {
          orgId, name: tpl.name, description: tpl.description, scope: InsightTemplateScope.WORKSPACE, isSystem: true, version: 1,
          sections: { create: tpl.sections.map((s, i) => ({ orgId, title: s.title, prompt: s.prompt, outputFormat: s.outputFormat, order: s.order ?? i })) },
        },
      });
    } catch (e) {
      // гонка двух одновременных первых заходов → партиальный unique-индекс отсекает дубль (P2002 игнорируем)
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
    }
  }
}

// ── Demo-fallback (детерминированный) для секции ──
function demoSection(transcript: string, section: { title: string; prompt: string; outputFormat: InsightOutputFormat }): string | string[] {
  const sentences = transcript.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  // ключевые слова из prompt (без стоп-слов), ищем релевантные предложения
  const stop = new Set(['the', 'a', 'an', 'of', 'to', 'and', 'or', 'what', 'does', 'list', 'any', 'said', 'they', 'for', 'this', 'in', 'on', 'is', 'are', 'about', 'if', 'when', 'do', 'their', 'has', 'have']);
  const kw = section.prompt.toLowerCase().match(/[a-z]{4,}/g)?.filter((w) => !stop.has(w)) ?? [];
  const relevant = sentences.filter((s) => kw.some((w) => s.toLowerCase().includes(w)));
  const pick = (relevant.length ? relevant : sentences).slice(0, section.outputFormat === InsightOutputFormat.BULLETS ? 3 : 2);
  if (section.outputFormat === InsightOutputFormat.BULLETS) {
    return pick.length ? pick.map((s) => s.slice(0, 160)) : ['Not mentioned in the transcript.'];
  }
  return pick.length ? pick.join(' ').slice(0, 400) : `Not mentioned in the transcript for "${section.title}".`;
}

async function runSection(transcript: string, section: { title: string; prompt: string; outputFormat: InsightOutputFormat }): Promise<{ content: string | string[]; generatedBy: string }> {
  if (!llmAvailable()) return { content: demoSection(transcript, section), generatedBy: 'demo' };
  try {
    if (section.outputFormat === InsightOutputFormat.BULLETS) {
      const out = await llmComplete({
        system: 'You are a sales call-intelligence assistant. Using ONLY the provided transcript, answer the section instruction. Reply as a STRICT JSON array of 2-5 short bullet strings (no markdown). If nothing relevant, return ["Not mentioned in the transcript."].',
        prompt: `Section: ${section.title}\nInstruction: ${section.prompt}\nTranscript:\n${transcript}`,
        json: true, maxTokens: 400, temperature: 0.3,
      });
      const parsed = JSON.parse(out.replace(/^```json\s*|\s*```$/g, '')) as unknown;
      const arr = Array.isArray(parsed) ? parsed : (parsed as { items?: unknown[] })?.items;
      if (Array.isArray(arr)) return { content: arr.slice(0, 8).map((x) => String(x).slice(0, 200)).filter(Boolean), generatedBy: llmProvider() };
      return { content: demoSection(transcript, section), generatedBy: 'demo' };
    }
    const out = await llmComplete({
      system: 'You are a sales call-intelligence assistant. Using ONLY the provided transcript, answer the section instruction in 1-3 factual sentences. No markdown. If nothing relevant, say so plainly.',
      prompt: `Section: ${section.title}\nInstruction: ${section.prompt}\nTranscript:\n${transcript}`,
      maxTokens: 400, temperature: 0.3,
    });
    return { content: String(out).trim().slice(0, 800), generatedBy: llmProvider() };
  } catch {
    return { content: demoSection(transcript, section), generatedBy: 'demo' };
  }
}

// ── Прогон шаблона над звонком ──
export type RunResultSection = { sectionId: string; sectionTitle: string; order: number; outputFormat: InsightOutputFormat; content: string | string[] };

export async function runTemplateOnCall(params: {
  orgId: string; userId: string; role: Role; callId: string; templateId: string; force?: boolean; clientRequestId?: string | null;
}): Promise<{ run: { id: string; callId: string; templateId: string; templateName: string; templateVersion: number; results: RunResultSection[]; creditsCharged: number; generatedBy: string; createdAt: Date }; deduped: boolean; estimateCredits: number }> {
  const { orgId, userId, role, callId, templateId } = params;

  const call = await prisma.call.findFirst({ where: { id: callId, orgId, archivedAt: null }, select: { id: true, transcript: true } });
  if (!call) throw new CallInsightError('CALL_NOT_FOUND', 'Call not found', 404);
  if (!call.transcript || !call.transcript.trim()) throw new CallInsightError('NO_TRANSCRIPT', 'Add a transcript to this call before running insights', 409);
  if (call.transcript.length > TRANSCRIPT_CAP) throw new CallInsightError('TRANSCRIPT_TOO_LONG', `Transcript exceeds ${TRANSCRIPT_CAP} characters`, 413);

  const template = await prisma.insightTemplate.findFirst({
    where: { id: templateId, ...visibleTemplatesWhere(orgId, userId, role) },
    include: { sections: { orderBy: { order: 'asc' } } },
  });
  if (!template) throw new CallInsightError('TEMPLATE_NOT_FOUND', 'Template not found or not visible', 404);
  if (!template.sections.length) throw new CallInsightError('TEMPLATE_NO_SECTIONS', 'Template has no sections');

  const hash = transcriptHash(call.transcript);
  const baseKey = `call-insight:${callId}:${templateId}:${hash}:${template.version}`;
  const force = !!params.force && !!params.clientRequestId;
  const idempotencyKey = force ? `${baseKey}:force:${params.clientRequestId}` : baseKey;
  const cost = template.sections.length * CREDIT_PER_SECTION;

  // без force: тот же call/template/transcript/version → возвращаем существующий run, БЕЗ повторного списания
  if (!force) {
    const existing = await prisma.callInsightRun.findUnique({ where: { orgId_idempotencyKey: { orgId, idempotencyKey } } });
    if (existing) return { run: serializeRun(existing), deduped: true, estimateCredits: cost };
  }

  // кредиты: нет → 402 ДО запуска LLM
  await assertCredits(orgId, cost, 'CALL_INSIGHT');

  const normalized = normalizeTranscript(call.transcript);
  const sectionResults: RunResultSection[] = [];
  let generatedBy = 'demo';
  for (const s of template.sections) {
    const r = await runSection(normalized, s);
    if (r.generatedBy !== 'demo') generatedBy = r.generatedBy;
    sectionResults.push({ sectionId: s.id, sectionTitle: s.title, order: s.order, outputFormat: s.outputFormat, content: r.content });
  }

  // Адверс-ревью C1: НЕ заряжаем до создания run (иначе сбой create → списано, но run нет).
  // 1) CLAIM run-строку первой (unique idempotencyKey). Гонка → вернуть победителя БЕЗ списания (он спишет).
  let created;
  try {
    created = await prisma.callInsightRun.create({
      data: {
        orgId, callId, templateId, templateName: template.name, templateVersion: template.version, transcriptHash: hash,
        results: sectionResults as unknown as Prisma.InputJsonValue, creditsCharged: cost, generatedBy, idempotencyKey, createdById: userId,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const existing = await prisma.callInsightRun.findUnique({ where: { orgId_idempotencyKey: { orgId, idempotencyKey } } });
      if (existing) return { run: serializeRun(existing), deduped: true, estimateCredits: cost };
    }
    throw e; // сбой create до списания → ничего не заряжено
  }

  // 2) Списываем (идемпотентно по тому же ключу). Сбой (баланс выкачали гонкой) → КОМПЕНСИРУЕМ: удаляем run.
  try {
    await debitCredits({ orgId, amount: cost, source: 'CALL_INSIGHT', idempotencyKey, reason: `call insight: ${template.name}`, userId, metadata: { callId, templateId, sections: template.sections.length } });
  } catch (e) {
    await prisma.callInsightRun.delete({ where: { id: created.id } }).catch(() => undefined);
    throw e; // 402 — ни списания, ни run-строки
  }

  return { run: serializeRun(created), deduped: false, estimateCredits: cost };
}

function serializeRun(r: { id: string; callId: string; templateId: string; templateName: string; templateVersion: number; results: Prisma.JsonValue; creditsCharged: number; generatedBy: string; createdAt: Date }) {
  return {
    id: r.id, callId: r.callId, templateId: r.templateId, templateName: r.templateName, templateVersion: r.templateVersion,
    results: (Array.isArray(r.results) ? r.results : []) as unknown as RunResultSection[],
    creditsCharged: r.creditsCharged, generatedBy: r.generatedBy, createdAt: r.createdAt,
  };
}
