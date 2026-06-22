/**
 * AI-генерация outbound-последовательности кампании.
 *
 * Агент сам пишет многошаговую цепочку (email/LinkedIn) под параметры кампании
 * (индустрия/гео/размер), с токенами персонализации {{firstName}}/{{company}}/
 * {{title}}/{{industry}}. С ключом LLM (DeepSeek) — реально генерирует, без ключа —
 * детерминированный шаблон (demo).
 */

import { llmAvailable, llmComplete, llmProvider, parseJsonLoose } from './llm';

export interface SequenceGenStep {
  stepNumber: number;
  delayDays: number;
  subject: string;
  body: string;
  channel: 'EMAIL' | 'LINKEDIN';
}

export interface SequenceGenInput {
  campaignName: string;
  channel: 'EMAIL' | 'LINKEDIN';
  targetIndustry?: string | null;
  targetCountry?: string | null;
  targetSize?: string | null;
  steps?: number;
  language?: 'en' | 'ru' | 'de';
  tone?: 'professional' | 'casual' | 'friendly';
  valueProposition?: string;
  senderName?: string;
  senderCompany?: string;
}

export interface SequenceGenResult {
  steps: SequenceGenStep[];
  generatedBy: 'deepseek' | 'anthropic' | 'demo';
}

const LANG_NAME: Record<string, string> = { en: 'English', ru: 'Russian', de: 'German' };

/** Накопительные задержки между шагами: 0, 3, 7, 11, … */
function delayForStep(i: number): number {
  return i === 0 ? 0 : 3 + (i - 1) * 4;
}

// ─── Demo-шаблон (без ключа LLM) ────────────────────────────────────────────

function demoSequence(input: SequenceGenInput): SequenceGenStep[] {
  const n = Math.min(Math.max(input.steps ?? 3, 1), 6);
  const channel = input.channel;
  const lang = input.language ?? 'en';
  const company = input.senderCompany?.trim() || 'our team';
  const vp =
    input.valueProposition?.trim() ||
    (lang === 'ru'
      ? 'быстрее находить и прорабатывать подходящих B2B-лидов'
      : lang === 'de'
        ? 'passende B2B-Leads schneller zu bearbeiten'
        : 'find and work qualified B2B leads faster');

  const steps: SequenceGenStep[] = [];
  for (let i = 0; i < n; i += 1) {
    const isFirst = i === 0;
    const isLast = i === n - 1;
    let subject = '';
    let body = '';

    if (lang === 'ru') {
      subject = channel === 'LINKEDIN' ? '' : isFirst ? '{{company}}: короткая идея' : isLast ? 'Последнее письмо по теме' : 'Re: {{company}} — короткая идея';
      body = isFirst
        ? `{{firstName}}, добрый день. Обратил внимание на вашу роль {{title}} в {{company}}. ${company} помогает командам ${vp}. Будет уместно обсудить на 15-минутном звонке?`
        : isLast
          ? `{{firstName}}, не хочу быть навязчивым — это последнее письмо. Если тема ${vp} сейчас не в приоритете, дайте знать, и я больше не побеспокою. Если актуально — отвечу на любые вопросы.`
          : `{{firstName}}, возвращаюсь к своему сообщению. Многие команды в {{industry}} используют это, чтобы ускорить outbound без потери качества. Открыты к короткому звонку?`;
    } else if (lang === 'de') {
      subject = channel === 'LINKEDIN' ? '' : isFirst ? '{{company}}: kurze Idee' : isLast ? 'Letzte Nachricht dazu' : 'Re: {{company}} — kurze Idee';
      body = isFirst
        ? `Hallo {{firstName}}, mir ist Ihre Rolle als {{title}} bei {{company}} aufgefallen. ${company} hilft Teams, ${vp}. Wären Sie offen für ein kurzes 15-minütiges Gespräch?`
        : isLast
          ? `Hallo {{firstName}}, das ist meine letzte Nachricht dazu. Falls ${vp} gerade keine Priorität ist, sagen Sie kurz Bescheid.`
          : `Hallo {{firstName}}, ich komme auf meine Nachricht zurück. Viele Teams in {{industry}} nutzen das, um Outbound zu beschleunigen. Offen für einen kurzen Call?`;
    } else {
      subject = channel === 'LINKEDIN' ? '' : isFirst ? '{{company}}: quick idea' : isLast ? 'Last note from me' : 'Re: {{company}} — quick idea';
      body = isFirst
        ? `Hi {{firstName}}, I noticed your role as {{title}} at {{company}}. ${company} helps teams ${vp}. Would you be open to a quick 15-minute call?`
        : isLast
          ? `Hi {{firstName}}, this is my last note — I don't want to crowd your inbox. If ${vp} isn't a priority right now, just let me know and I'll stop here.`
          : `Hi {{firstName}}, circling back on my note. Teams in {{industry}} use this to move outbound faster without losing personalization. Open to a short call?`;
    }

    steps.push({ stepNumber: i + 1, delayDays: delayForStep(i), subject, body, channel });
  }
  return steps;
}

// ─── Реальная генерация (LLM) ────────────────────────────────────────────────

function buildPrompt(input: SequenceGenInput): string {
  const n = Math.min(Math.max(input.steps ?? 3, 1), 6);
  const lang = LANG_NAME[input.language ?? 'en'] ?? 'English';
  const targeting = [
    input.targetIndustry ? `Industry: ${input.targetIndustry}` : null,
    input.targetCountry ? `Country: ${input.targetCountry}` : null,
    input.targetSize ? `Company size: ${input.targetSize}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return [
    `You are an expert B2B SDR. Write a ${n}-step ${input.channel} outbound sequence for the campaign "${input.campaignName}".`,
    targeting ? `Target audience: ${targeting}.` : '',
    input.valueProposition ? `Value proposition: ${input.valueProposition}.` : '',
    input.senderCompany ? `Sender company: ${input.senderCompany}.` : '',
    input.senderName ? `Sender name: ${input.senderName}.` : '',
    `Tone: ${input.tone ?? 'professional'}. Language: ${lang}.`,
    '',
    'Rules:',
    '- Step 1 is the opener; later steps are short follow-ups referencing the previous touch.',
    '- Use personalization tokens EXACTLY as: {{firstName}}, {{company}}, {{title}}, {{industry}}. Do not invent other tokens.',
    input.channel === 'LINKEDIN'
      ? '- LinkedIn: no subject (empty string), keep each body under ~400 characters.'
      : '- Email: include a short compelling subject and a 2-4 sentence body.',
    '- No "I hope this finds you well" or generic filler. Be specific and value-first.',
    '- Each step must include ONE clear, low-friction call to action.',
    '- The last step is a polite break-up message.',
    '',
    `Return ONLY a JSON object: {"steps": [{"stepNumber": 1, "delayDays": 0, "subject": "...", "body": "..."}, ...]}.`,
    `Provide exactly ${n} steps. delayDays is days to wait BEFORE this step (step 1 = 0).`,
  ]
    .filter(Boolean)
    .join('\n');
}

export async function generateSequence(input: SequenceGenInput): Promise<SequenceGenResult> {
  const n = Math.min(Math.max(input.steps ?? 3, 1), 6);

  if (!llmAvailable()) {
    return { steps: demoSequence(input), generatedBy: 'demo' };
  }

  const text = await llmComplete({
    prompt: buildPrompt(input),
    maxTokens: 1800,
    temperature: 0.6,
    json: true,
  });

  const parsed = parseJsonLoose<{ steps?: Array<Partial<SequenceGenStep>> }>(text);
  const raw = parsed?.steps;

  if (!raw || !Array.isArray(raw) || raw.length === 0) {
    // Модель не дала валидный JSON — не падаем, отдаём demo-шаблон.
    return { steps: demoSequence(input), generatedBy: 'demo' };
  }

  const steps: SequenceGenStep[] = raw.slice(0, n).map((s, i) => ({
    stepNumber: i + 1,
    delayDays: typeof s.delayDays === 'number' && s.delayDays >= 0 ? Math.round(s.delayDays) : delayForStep(i),
    subject: input.channel === 'LINKEDIN' ? '' : (s.subject ?? '').toString().slice(0, 200),
    body: (s.body ?? '').toString().trim() || demoSequence(input)[i]?.body || '',
    channel: input.channel,
  }));

  return { steps, generatedBy: llmProvider() === 'anthropic' ? 'anthropic' : 'deepseek' };
}
