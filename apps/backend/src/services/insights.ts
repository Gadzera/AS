/**
 * Движок Learning-инсайтов.
 *
 * Считает РЕАЛЬНЫЕ агрегаты по данным org (классы ответов, разрез по индустрии,
 * скоринг лидов, AI-прогоны, статусы кампаний), затем:
 *   - с ключом LLM (DeepSeek) — просит модель сформулировать проверяемые
 *     learnings (что выучил / почему / контр-довод / рекомендация) НА ОСНОВЕ цифр;
 *   - без ключа — строит grounded-инсайты прямо из агрегатов (не выдумка).
 */

import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import { llmAvailable, llmJson, llmProvider } from './llm';

const prisma = new PrismaClient();

// Стабильный ключ инсайта для ack-персистентности: не зависит от эфемерного id
// и от плавающих чисел в title — берём type|scope (устойчивы для grounded и LLM).
export function insightKey(type: string, scope: string): string {
  return createHash('sha1').update(`${type}|${scope}`).digest('hex').slice(0, 16);
}

export interface InsightEvidence {
  label: string;
  value: string;
}

export interface Insight {
  id: string;
  key: string; // стабильный ключ (для ack), = sha1(type|scope)
  acknowledged: boolean; // отмечен ли оператором как просмотренный (из insight_acks)
  title: string;
  type: string;
  scope: string;
  conf: number;
  impact: string;
  status: 'Ready to promote' | 'Needs review' | 'Needs more data';
  learned: string;
  evidence: InsightEvidence[];
  validated: string;
  why: string;
  counter: string;
  rec: string;
}

// Инсайт до простановки ack-полей (их вешает generateInsights из insight_acks).
export type BaseInsight = Omit<Insight, 'key' | 'acknowledged'>;

export interface InsightsResult {
  insights: Insight[];
  generatedBy: 'deepseek' | 'anthropic' | 'demo';
  aggregates: Aggregates;
}

interface IndustryStat {
  industry: string;
  total: number;
  interested: number;
  rate: number;
}

interface Aggregates {
  replies: { total: number; byClass: Record<string, number>; interestedRate: number };
  byIndustry: IndustryStat[];
  leads: { total: number; avgScore: number; avgScoreReplied: number };
  ai: { totalRuns: number; byType: Record<string, number> };
  campaigns: { total: number; active: number };
  enrolled: number;
}

const REPLY_CLASSES = ['INTERESTED', 'NOT_INTERESTED', 'FOLLOW_UP', 'UNSUBSCRIBE'] as const;

// ─── Агрегаты ────────────────────────────────────────────────────────────────

async function gatherAggregates(orgId: string): Promise<Aggregates> {
  const [inbound, leads, aiRuns, campaigns, enrolled] = await Promise.all([
    prisma.message.findMany({
      where: { direction: 'INBOUND', lead: { orgId } },
      select: { replyClass: true, lead: { select: { industry: true, score: true } } },
    }),
    prisma.lead.findMany({ where: { orgId }, select: { score: true } }),
    prisma.aiRun.groupBy({ by: ['aiType'], where: { orgId }, _count: { _all: true } }),
    prisma.campaign.findMany({ where: { orgId }, select: { status: true } }),
    prisma.campaignLead.count({ where: { campaign: { orgId } } }),
  ]);

  const byClass: Record<string, number> = {};
  for (const c of REPLY_CLASSES) byClass[c] = 0;
  const industryMap = new Map<string, { total: number; interested: number }>();
  let repliedScoreSum = 0;
  let repliedCount = 0;

  for (const m of inbound) {
    const cls = m.replyClass ?? 'FOLLOW_UP';
    byClass[cls] = (byClass[cls] ?? 0) + 1;
    const ind = m.lead?.industry?.trim() || 'Unknown';
    const e = industryMap.get(ind) ?? { total: 0, interested: 0 };
    e.total += 1;
    if (cls === 'INTERESTED') e.interested += 1;
    industryMap.set(ind, e);
    if (typeof m.lead?.score === 'number') {
      repliedScoreSum += m.lead.score;
      repliedCount += 1;
    }
  }

  const total = inbound.length;
  const interested = byClass.INTERESTED ?? 0;

  const byIndustry: IndustryStat[] = [...industryMap.entries()]
    .map(([industry, v]) => ({
      industry,
      total: v.total,
      interested: v.interested,
      rate: v.total ? Math.round((v.interested / v.total) * 100) : 0,
    }))
    .filter((s) => s.industry !== 'Unknown' && s.total >= 2)
    .sort((a, b) => b.rate - a.rate || b.total - a.total);

  const byType: Record<string, number> = {};
  let totalRuns = 0;
  for (const r of aiRuns) {
    byType[r.aiType] = r._count._all;
    totalRuns += r._count._all;
  }

  const avgScore = leads.length ? Math.round(leads.reduce((s, l) => s + l.score, 0) / leads.length) : 0;

  return {
    replies: { total, byClass, interestedRate: total ? Math.round((interested / total) * 100) : 0 },
    byIndustry,
    leads: {
      total: leads.length,
      avgScore,
      avgScoreReplied: repliedCount ? Math.round(repliedScoreSum / repliedCount) : 0,
    },
    ai: { totalRuns, byType },
    campaigns: { total: campaigns.length, active: campaigns.filter((c) => c.status === 'ACTIVE').length },
    enrolled,
  };
}

// ─── Grounded-инсайты без LLM ────────────────────────────────────────────────

function demoInsights(a: Aggregates): BaseInsight[] {
  const out: BaseInsight[] = [];
  const enoughReplies = a.replies.total >= 5;

  // 1) Структура ответов / interested rate
  const dominant = Object.entries(a.replies.byClass).sort((x, y) => y[1] - x[1])[0]?.[0] ?? 'FOLLOW_UP';
  out.push({
    id: 'reply-mix',
    title: `Interested rate holds at ${a.replies.interestedRate}% across ${a.replies.total} replies`,
    type: 'Reply learning',
    scope: 'All campaigns',
    conf: enoughReplies ? 72 : 40,
    impact: `${a.replies.interestedRate}% interested`,
    status: enoughReplies ? 'Needs review' : 'Needs more data',
    learned: `Of ${a.replies.total} classified replies, ${a.replies.byClass.INTERESTED ?? 0} are INTERESTED, ${a.replies.byClass.FOLLOW_UP ?? 0} FOLLOW_UP, ${a.replies.byClass.NOT_INTERESTED ?? 0} NOT_INTERESTED. Dominant class: ${dominant}.`,
    evidence: REPLY_CLASSES.map((c) => ({ label: c, value: String(a.replies.byClass[c] ?? 0) })),
    validated: enoughReplies ? `Across ${a.replies.total} replies` : 'Low sample size',
    why: 'Computed directly from classified inbound replies in the workspace.',
    counter: dominant === 'FOLLOW_UP' ? 'Many FOLLOW_UP replies may be soft interest that needs faster human follow-through.' : 'Class balance can shift as more campaigns run.',
    rec: enoughReplies ? 'Prioritize fast human follow-up on INTERESTED + FOLLOW_UP' : 'Send more volume before drawing conclusions',
  });

  // 2) Лучшая индустрия по interested-rate
  const top = a.byIndustry[0];
  if (top) {
    out.push({
      id: 'industry-fit',
      title: `${top.industry} replies best — ${top.rate}% interested`,
      type: 'Segment learning',
      scope: top.industry,
      conf: top.total >= 5 ? 76 : 48,
      impact: `${top.rate}% interested`,
      status: top.total >= 5 ? 'Ready to promote' : 'Needs more data',
      learned: `${top.industry} shows the highest interested-rate (${top.interested}/${top.total}) among industries with enough replies.`,
      evidence: a.byIndustry.slice(0, 4).map((s) => ({ label: s.industry, value: `${s.rate}%` })),
      validated: `Across ${top.total} replies in ${top.industry}`,
      why: 'Interested-rate aggregated by lead industry over classified replies.',
      counter: 'Sample per industry is still small — rate can regress with more sends.',
      rec: `Weight ${top.industry} higher in ICP targeting`,
    });
  }

  // 3) AI-использование
  if (a.ai.totalRuns > 0) {
    const topType = Object.entries(a.ai.byType).sort((x, y) => y[1] - x[1])[0];
    out.push({
      id: 'ai-usage',
      title: `Agent ran ${a.ai.totalRuns} AI enrichments — ${topType?.[0] ?? 'RESEARCH'} leads`,
      type: 'Operations learning',
      scope: 'Data Hub',
      conf: 80,
      impact: `${a.ai.totalRuns} runs`,
      status: 'Needs review',
      learned: `AI enrichment usage by type: ${Object.entries(a.ai.byType).map(([k, v]) => `${k} ${v}`).join(', ')}.`,
      evidence: Object.entries(a.ai.byType).map(([k, v]) => ({ label: k, value: String(v) })),
      validated: `Across ${a.ai.totalRuns} runs`,
      why: 'Aggregated from AiRun history.',
      counter: 'High RESEARCH usage costs more credits (10 each) — watch the burn rate.',
      rec: 'Reserve RESEARCH for high-ICP accounts; use SUMMARIZE/CLASSIFY for the rest',
    });
  }

  return out;
}

// ─── LLM-инсайты ─────────────────────────────────────────────────────────────

interface RawInsight {
  title?: string;
  type?: string;
  scope?: string;
  conf?: number;
  impact?: string;
  status?: string;
  learned?: string;
  evidence?: Array<{ label?: string; value?: string }>;
  validated?: string;
  why?: string;
  counter?: string;
  rec?: string;
}

function normStatus(s?: string): Insight['status'] {
  const v = (s ?? '').toLowerCase();
  if (v.includes('promote') || v.includes('ready')) return 'Ready to promote';
  if (v.includes('data')) return 'Needs more data';
  return 'Needs review';
}

// Вешает стабильный key и acknowledged (из insight_acks org) на каждый инсайт.
async function withAcks(orgId: string, base: BaseInsight[]): Promise<Insight[]> {
  const keyed = base.map((b) => ({ ...b, key: insightKey(b.type, b.scope) }));
  const acks = await prisma.insightAck.findMany({
    where: { orgId, insightKey: { in: keyed.map((k) => k.key) } },
    select: { insightKey: true },
  });
  const ackedKeys = new Set(acks.map((a) => a.insightKey));
  return keyed.map((k) => ({ ...k, acknowledged: ackedKeys.has(k.key) }));
}

export async function generateInsights(orgId: string): Promise<InsightsResult> {
  const aggregates = await gatherAggregates(orgId);

  if (!llmAvailable() || aggregates.replies.total === 0) {
    return { insights: await withAcks(orgId, demoInsights(aggregates)), generatedBy: 'demo', aggregates };
  }

  const evidencePack = JSON.stringify(aggregates);
  const prompt = [
    'You are an AI-SDR learning engine. Below are REAL aggregate metrics from a B2B outbound workspace (JSON).',
    'Derive 3-4 concrete, verifiable LEARNINGS strictly from these numbers — do NOT invent data not present.',
    '',
    'Metrics:',
    evidencePack,
    '',
    'For each learning return: title (short), type (e.g. "Segment learning"/"Reply learning"/"Operations learning"),',
    'scope (which segment/industry/all), conf (0-100 integer = how strongly the data supports it; small samples → lower),',
    'impact (short metric string), status ("Ready to promote" | "Needs review" | "Needs more data"),',
    'learned (1-2 sentences grounded in the numbers), evidence (array of {label,value} pulled from the metrics),',
    'validated (sample-size note), why (mechanism), counter (an honest caveat or where it does NOT hold),',
    'rec (one concrete recommended action).',
    '',
    'Return ONLY JSON: {"insights":[ ... ]}. Be conservative: if a sample is tiny, say "Needs more data".',
  ].join('\n');

  const parsed = await llmJson<{ insights?: RawInsight[] }>({ prompt, maxTokens: 1800, temperature: 0.4 });
  const raw = parsed?.insights;

  if (!raw || !Array.isArray(raw) || raw.length === 0) {
    return { insights: await withAcks(orgId, demoInsights(aggregates)), generatedBy: 'demo', aggregates };
  }

  const insights: BaseInsight[] = raw.slice(0, 5).map((r, i) => ({
    id: `llm-${i}`,
    title: (r.title ?? 'Learning').toString().slice(0, 160),
    type: (r.type ?? 'Learning').toString().slice(0, 40),
    scope: (r.scope ?? 'All campaigns').toString().slice(0, 60),
    conf: Math.max(0, Math.min(100, Math.round(Number(r.conf) || 50))),
    impact: (r.impact ?? '—').toString().slice(0, 40),
    status: normStatus(r.status),
    learned: (r.learned ?? '').toString().slice(0, 600),
    evidence: Array.isArray(r.evidence)
      ? r.evidence.slice(0, 6).map((e) => ({ label: (e.label ?? '').toString().slice(0, 30), value: (e.value ?? '').toString().slice(0, 24) }))
      : [],
    validated: (r.validated ?? '').toString().slice(0, 80),
    why: (r.why ?? '').toString().slice(0, 400),
    counter: (r.counter ?? '').toString().slice(0, 400),
    rec: (r.rec ?? '').toString().slice(0, 200),
  }));

  return { insights: await withAcks(orgId, insights), generatedBy: llmProvider() === 'anthropic' ? 'anthropic' : 'deepseek', aggregates };
}

// Тоггл «просмотрено» по стабильному ключу инсайта (идемпотентно).
export async function setInsightAck(orgId: string, key: string, acknowledged: boolean): Promise<boolean> {
  if (acknowledged) {
    await prisma.insightAck.upsert({
      where: { orgId_insightKey: { orgId, insightKey: key } },
      create: { orgId, insightKey: key },
      update: {},
    });
  } else {
    await prisma.insightAck.deleteMany({ where: { orgId, insightKey: key } });
  }
  return acknowledged;
}
