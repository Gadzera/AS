/**
 * Движок стратегии плейбука (Strategy spine).
 *
 * Из реальной кампании (таргетинг + её последовательность) формирует «паспорт
 * стратегии»: ICP/scoring, buying committee, signals, messaging, objections,
 * sequence blueprint, guardrails, learning. Секция Sequence строится из РЕАЛЬНЫХ
 * шагов; остальные — LLM (DeepSeek) или templated demo без ключа.
 */

import { llmAvailable, llmJson, llmProvider } from './llm';

export type SpineStatus = 'Complete' | 'Needs review' | 'In use';

export interface SpineSection {
  key: string;
  title: string;
  status: SpineStatus;
  items: string[];
}

export interface StrategyInput {
  campaignName: string;
  channel: 'EMAIL' | 'LINKEDIN';
  targetIndustry?: string | null;
  targetCountry?: string | null;
  targetSize?: string | null;
  steps: Array<{ stepNumber: number; delayDays: number; subject?: string | null; channel: string; body: string }>;
}

export interface StrategyResult {
  spine: SpineSection[];
  generatedBy: 'deepseek' | 'anthropic' | 'demo';
}

// ─── Sequence blueprint из реальных шагов ────────────────────────────────────

function sequenceSection(input: StrategyInput): SpineSection {
  if (!input.steps.length) {
    return {
      key: 'sequence',
      title: 'Sequence blueprint',
      status: 'Needs review',
      items: ['No steps yet — generate the sequence in Outreach Studio.'],
    };
  }
  const items: string[] = [];
  for (const s of input.steps) {
    const ch = s.channel === 'LINKEDIN' ? 'LinkedIn' : 'Email';
    const subj = s.subject?.trim() ? ` · "${s.subject.trim().slice(0, 48)}"` : '';
    items.push(`Step ${s.stepNumber} ${ch}${subj}`);
    if (s.delayDays > 0) items.push(`Wait ${s.delayDays} day${s.delayDays === 1 ? '' : 's'}`);
  }
  return { key: 'sequence', title: 'Sequence blueprint', status: 'In use', items: items.slice(0, 10) };
}

// ─── Demo-стратегия (без ключа) ──────────────────────────────────────────────

function demoSpine(input: StrategyInput): SpineSection[] {
  const ind = input.targetIndustry?.trim() || 'B2B SaaS';
  const size = input.targetSize?.trim() || '50–500 employees';
  const geo = input.targetCountry?.trim() || 'US / EU';

  return [
    { key: 'icp', title: 'ICP & scoring', status: 'In use', items: [`Firmographic: ${size} · ${geo} · ${ind}`, 'Scoring: firmo 40 · pain 35 · market 25', 'Exclusions: agencies · students · pre-revenue', 'Evidence required: 2 sources min'] },
    { key: 'persona', title: 'Buying committee', status: 'Complete', items: ['Economic buyer: VP / Head of function', 'Champion: ops / RevOps lead', 'Blocker: incumbent tool owner', 'Decision: ROI + integration effort'] },
    { key: 'signals', title: 'Signal taxonomy', status: 'Needs review', items: ['Hiring in target function (30d)', 'Funding / expansion (30d)', 'Pricing / evaluation intent (7d)', 'Tech: legacy stack in use'] },
    { key: 'messaging', title: 'Messaging system', status: 'In use', items: [`Offer tuned for ${ind}`, 'Angles: operational pain · trigger · persona', 'Tone: direct, exec, no fluff', 'Do-not-say: pricing claims · competitor FUD'] },
    { key: 'objections', title: 'Objection handling', status: 'Complete', items: ['"Already use a tool" → works alongside', '"No time this quarter" → 15-min async', '"Send info" → tailored 1-pager + soft CTA', 'Escalate to human on pricing pushback'] },
    sequenceSection(input),
    { key: 'guardrails', title: 'Guardrails', status: 'Complete', items: ['Compliance: unsubscribe on · CAN-SPAM', 'Suppression: customers · open opportunities', 'Approval: auto high-conf · human low-conf', 'Claims not allowed: ROI %, competitor FUD'] },
    { key: 'learning', title: 'Learning', status: 'Needs review', items: ['Winning angle promoted on evidence', 'A/B on subject line running', 'Rejected: aggressive breakup CTA', 'Calibration reviewed weekly'] },
  ];
}

// ─── LLM-стратегия ───────────────────────────────────────────────────────────

interface RawSection {
  key?: string;
  title?: string;
  status?: string;
  items?: string[];
}

const SECTION_TITLES: Record<string, string> = {
  icp: 'ICP & scoring',
  persona: 'Buying committee',
  signals: 'Signal taxonomy',
  messaging: 'Messaging system',
  objections: 'Objection handling',
  guardrails: 'Guardrails',
  learning: 'Learning',
};

function normSpineStatus(s?: string): SpineStatus {
  const v = (s ?? '').toLowerCase();
  if (v.includes('review')) return 'Needs review';
  if (v.includes('use') || v.includes('live')) return 'In use';
  return 'Complete';
}

export async function generateStrategy(input: StrategyInput): Promise<StrategyResult> {
  const seq = sequenceSection(input);

  if (!llmAvailable()) {
    return { spine: demoSpine(input), generatedBy: 'demo' };
  }

  const prompt = [
    'You are an AI-SDR strategist. Build a reusable outbound STRATEGY SPINE for this campaign.',
    `Campaign: "${input.campaignName}". Channel: ${input.channel}.`,
    [
      input.targetIndustry ? `Industry: ${input.targetIndustry}` : null,
      input.targetCountry ? `Geo: ${input.targetCountry}` : null,
      input.targetSize ? `Company size: ${input.targetSize}` : null,
    ].filter(Boolean).join(' · '),
    '',
    'Produce these sections (key → meaning): icp (ICP & scoring), persona (buying committee),',
    'signals (signal taxonomy with weights), messaging (offer/angles/tone/do-not-say),',
    'objections (top objections + responses), guardrails (compliance/suppression/approval), learning (what to test).',
    'Each section = 3-4 short, concrete bullet items tailored to THIS audience. Do NOT include a sequence section.',
    '',
    'Return ONLY JSON: {"sections":[{"key":"icp","items":["..."]}, ...]}.',
  ].filter(Boolean).join('\n');

  const parsed = await llmJson<{ sections?: RawSection[] }>({ prompt, maxTokens: 1600, temperature: 0.5 });
  const raw = parsed?.sections;

  if (!raw || !Array.isArray(raw) || raw.length === 0) {
    return { spine: demoSpine(input), generatedBy: 'demo' };
  }

  // Собираем секции в каноническом порядке, sequence — из реальных шагов.
  const byKey = new Map<string, RawSection>();
  for (const s of raw) if (s.key) byKey.set(s.key.toLowerCase(), s);

  const order = ['icp', 'persona', 'signals', 'messaging', 'objections', 'sequence', 'guardrails', 'learning'];
  const spine: SpineSection[] = order.map((key) => {
    if (key === 'sequence') return seq;
    const r = byKey.get(key);
    const items = Array.isArray(r?.items) ? r!.items!.map((i) => String(i).slice(0, 160)).filter(Boolean).slice(0, 5) : [];
    return {
      key,
      title: SECTION_TITLES[key] ?? key,
      status: items.length ? normSpineStatus(r?.status) : 'Needs review',
      items: items.length ? items : ['Needs more input — refine in settings.'],
    };
  });

  return { spine, generatedBy: llmProvider() === 'anthropic' ? 'anthropic' : 'deepseek' };
}
