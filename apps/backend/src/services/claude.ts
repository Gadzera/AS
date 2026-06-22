import { config } from '../config';
import { llmAvailable, llmComplete, llmJson, parseJsonLoose } from './llm';

interface LeadContext {
  firstName: string;
  lastName: string;
  email?: string | null;
  title?: string | null;
  company?: string | null;
  companySize?: string | null;
  industry?: string | null;
  country?: string | null;
  city?: string | null;
  website?: string | null;
  linkedinUrl?: string | null;
}

interface CampaignContext {
  name: string;
  channel: string;
  targetIndustry?: string | null;
}

interface OutreachContext {
  senderName?: string;
  senderTitle?: string;
  senderCompany?: string;
  language?: 'en' | 'ru' | 'de';
  valueProposition?: string;
  tone?: 'professional' | 'casual' | 'friendly';
  websiteContent?: string;
}

export interface GeneratedOutreach {
  subject: string;
  body: string;
  channel: string;
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

function getLeadName(lead: LeadContext): string {
  const fullName = ((lead.firstName ?? '') + ' ' + (lead.lastName ?? '')).trim();
  return fullName || lead.email || 'there';
}

function getFirstName(firstName?: string | null): string {
  return firstName?.trim() || 'there';
}

function getCompanyName(company?: string | null): string {
  return company?.trim() || 'your company';
}

function getRoleTitle(title?: string | null): string {
  return title?.trim() || 'your role';
}

function getSenderName(context: OutreachContext): string {
  return context.senderName?.trim() || 'the team';
}

function getSenderCompany(context: OutreachContext): string {
  return context.senderCompany?.trim() || 'our company';
}

function getValueProposition(context: OutreachContext, language: 'en' | 'ru' | 'de'): string {
  if (context.valueProposition?.trim()) {
    return context.valueProposition.trim();
  }

  if (language === 'ru') {
    return 'быстрее находить, приоритизировать и обрабатывать подходящих B2B-лидов';
  }

  if (language === 'de') {
    return 'passende B2B-Leads schneller zu finden, zu priorisieren und zu bearbeiten';
  }

  return 'find, prioritize, and handle qualified B2B leads faster';
}

function getSequenceStep(campaign: CampaignContext, context: OutreachContext): number {
  const campaignMeta = campaign as unknown as Record<string, unknown>;
  const contextMeta = context as unknown as Record<string, unknown>;

  const rawValues = [
    campaignMeta.step,
    campaignMeta.sequenceStep,
    campaignMeta.sequence_step,
    campaignMeta.stepNumber,
    campaignMeta.sequenceIndex,
    contextMeta.step,
    contextMeta.sequenceStep,
    contextMeta.sequence_step,
    contextMeta.stepNumber,
    contextMeta.sequenceIndex,
  ];

  for (const rawValue of rawValues) {
    const parsed = typeof rawValue === 'number' ? rawValue : parseInt(String(rawValue ?? ''), 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return 1;
}

function getToneLine(tone: 'professional' | 'casual' | 'friendly', language: 'en' | 'ru' | 'de'): string {
  if (language === 'ru') {
    if (tone === 'casual') return 'Пишу коротко и по делу.';
    if (tone === 'friendly') return 'Буду рад быстро обменяться контекстом.';
    return 'Пишу с конкретной идеей для вашей команды.';
  }

  if (language === 'de') {
    if (tone === 'casual') return 'Ich halte es kurz und direkt.';
    if (tone === 'friendly') return 'Ich würde mich über einen kurzen Austausch freuen.';
    return 'Ich schreibe mit einer konkreten Idee für Ihr Team.';
  }

  if (tone === 'casual') return 'Keeping this short and practical.';
  if (tone === 'friendly') return 'I thought this could be useful for your team.';
  return 'I am reaching out with a specific idea for your team.';
}

function getStepLine(step: number, language: 'en' | 'ru' | 'de'): string {
  if (step <= 1) {
    return '';
  }

  if (language === 'ru') {
    return 'Это короткое follow-up сообщение №' + step + ', чтобы не потерять контекст.';
  }

  if (language === 'de') {
    return 'Das ist ein kurzes Follow-up Nr. ' + step + ', damit der Kontext nicht verloren geht.';
  }

  return 'This is a short follow-up #' + step + ' to keep the context easy to review.';
}

function buildDemoOutreach(
  lead: LeadContext,
  campaign: CampaignContext,
  context: OutreachContext
): GeneratedOutreach {
  const language = context.language ?? 'en';
  const tone = context.tone ?? 'professional';
  const channel = campaign.channel;
  const normalizedChannel = channel.toUpperCase();
  const step = getSequenceStep(campaign, context);

  const firstName = getFirstName(lead.firstName);
  const leadName = getLeadName(lead);
  const company = getCompanyName(lead.company);
  const role = getRoleTitle(lead.title);
  const senderName = getSenderName(context);
  const senderCompany = getSenderCompany(context);
  const valueProposition = getValueProposition(context, language);
  const toneLine = getToneLine(tone, language);
  const stepLine = getStepLine(step, language);

  if (normalizedChannel === 'LINKEDIN') {
    if (language === 'ru') {
      return {
        subject: '',
        body: [
          firstName + ', добрый день.',
          stepLine,
          toneLine + ' Видел, что вы работаете как ' + role + ' в ' + company + '.',
          senderCompany + ' помогает ' + valueProposition + '. Открыты к короткому обмену?',
          '— ' + senderName,
        ]
          .filter(Boolean)
          .join(' '),
        channel,
      };
    }

    if (language === 'de') {
      return {
        subject: '',
        body: [
          'Hallo ' + firstName + ',',
          stepLine,
          toneLine + ' Ich habe gesehen, dass Sie als ' + role + ' bei ' + company + ' arbeiten.',
          senderCompany + ' hilft dabei, ' + valueProposition + '. Wären Sie offen für einen kurzen Austausch?',
          '— ' + senderName,
        ]
          .filter(Boolean)
          .join(' '),
        channel,
      };
    }

    return {
      subject: '',
      body: [
        'Hi ' + firstName + ',',
        stepLine,
        toneLine + ' I noticed you are ' + role + ' at ' + company + '.',
        senderCompany + ' helps teams ' + valueProposition + '. Open to a quick exchange?',
        '— ' + senderName,
      ]
        .filter(Boolean)
        .join(' '),
      channel,
    };
  }

  if (language === 'ru') {
    return {
      subject: company + ': идея для ' + leadName,
      body: [
        firstName + ', добрый день.',
        stepLine,
        toneLine +
          ' Обратил внимание на вашу роль ' +
          role +
          ' в ' +
          company +
          (lead.industry ? ' и фокус на ' + lead.industry : '') +
          '.',
        senderCompany +
          ' помогает командам ' +
          valueProposition +
          '. Обычно это полезно, когда нужно быстрее запускать outbound, не теряя качество персонализации.',
        'Будет ли уместно обсудить это на коротком 15-минутном звонке?',
        senderName,
      ]
        .filter(Boolean)
        .join('\n\n'),
      channel,
    };
  }

  if (language === 'de') {
    return {
      subject: company + ': kurze Idee',
      body: [
        'Hallo ' + firstName + ',',
        stepLine,
        toneLine +
          ' Mir ist Ihre Rolle als ' +
          role +
          ' bei ' +
          company +
          (lead.industry ? ' im Bereich ' + lead.industry : '') +
          ' aufgefallen.',
        senderCompany +
          ' hilft Teams dabei, ' +
          valueProposition +
          '. Das ist besonders relevant, wenn Outbound schneller laufen soll, ohne die Personalisierung zu verlieren.',
        'Wären Sie offen für ein kurzes 15-minütiges Gespräch?',
        senderName,
      ]
        .filter(Boolean)
        .join('\n\n'),
      channel,
    };
  }

  return {
    subject: company + ': quick idea',
    body: [
      'Hi ' + firstName + ',',
      stepLine,
      toneLine +
        ' I noticed your role as ' +
        role +
        ' at ' +
        company +
        (lead.industry ? ' in ' + lead.industry : '') +
        '.',
      senderCompany +
        ' helps teams ' +
        valueProposition +
        '. This is usually useful when outbound needs to move faster without losing personalization quality.',
      'Would you be open to a quick 15-minute call?',
      senderName,
    ]
      .filter(Boolean)
      .join('\n\n'),
    channel,
  };
}

/**
 * Генерирует персонализированное outreach-сообщение через Claude.
 * В demo-режиме без ANTHROPIC_API_KEY возвращает детерминированный шаблон.
 */
export async function generateOutreach(
  lead: LeadContext,
  campaign: CampaignContext,
  context: OutreachContext = {}
): Promise<GeneratedOutreach> {
  if (!llmAvailable()) {
    return buildDemoOutreach(lead, campaign, context);
  }

  const language = context.language ?? 'en';
  const tone = context.tone ?? 'professional';
  const channel = campaign.channel;

  const leadInfo = [
    'Name: ' + lead.firstName + ' ' + lead.lastName,
    lead.title ? 'Title: ' + lead.title : null,
    lead.company ? 'Company: ' + lead.company : null,
    lead.companySize ? 'Company size: ' + lead.companySize : null,
    lead.industry ? 'Industry: ' + lead.industry : null,
    lead.country ? 'Location: ' + (lead.city ? lead.city + ', ' : '') + lead.country : null,
    lead.website ? 'Website: ' + lead.website : null,
  ]
    .filter(Boolean)
    .join('\n');

  const senderInfo = [
    context.senderName ? 'Sender name: ' + context.senderName : null,
    context.senderTitle ? 'Sender title: ' + context.senderTitle : null,
    context.senderCompany ? 'Sender company: ' + context.senderCompany : null,
    context.valueProposition ? 'Value proposition: ' + context.valueProposition : null,
  ]
    .filter(Boolean)
    .join('\n');

  const languageInstruction = {
    en: 'Write in English.',
    ru: 'Write in Russian.',
    de: 'Write in German.',
  }[language];

  const channelInstruction =
    channel === 'LINKEDIN'
      ? 'This is a LinkedIn connection request / InMail message. Keep it under 300 characters for the connection note, or under 1000 characters for InMail. No formal subject line needed.'
      : 'This is a cold email. Include a compelling subject line and a well-structured body (3-5 short paragraphs).';

  const websiteSnippet = context.websiteContent
    ? '\nLead\'s company website content (use specific details from this to personalize):\n"""\n' +
      context.websiteContent +
      '\n"""'
    : '';

  const responseFormatInstruction =
    channel === 'LINKEDIN'
      ? 'Respond with JSON: {"subject": "", "body": "the LinkedIn message text"}'
      : 'Respond with JSON: {"subject": "email subject line", "body": "full email body with line breaks as \\n"}';

  const prompt = [
    'You are an expert B2B sales development representative (SDR). Your task is to write a highly personalized ' +
      (channel === 'LINKEDIN' ? 'LinkedIn' : 'email') +
      ' outreach message.',
    '',
    channelInstruction,
    languageInstruction,
    'Tone: ' + tone,
    'Campaign: ' + campaign.name,
    '',
    'Lead information:',
    leadInfo,
    '',
    senderInfo ? 'Sender information:\n' + senderInfo : '',
    websiteSnippet,
    'Requirements:',
    '1. Personalize the message based on the lead\'s company, industry, and role',
    '2. Focus on their specific pain points and how you can help',
    '3. Be concise and value-focused — no fluff',
    '4. Include a clear, low-friction call to action (e.g., "Would you be open to a 15-minute call?")',
    '5. Do NOT use generic phrases like "I hope this finds you well" or "I wanted to reach out"',
    '6. Reference something specific about their company or industry',
    '',
    responseFormatInstruction,
    '',
    'Only respond with valid JSON, no markdown, no extra text.',
  ].join('\n');

  const text = await llmComplete({ prompt, maxTokens: 1024, json: true });
  const parsed = parseJsonLoose<{ subject?: string; body?: string }>(text);

  if (parsed) {
    return {
      subject: parsed.subject ?? '',
      body: parsed.body ?? '',
      channel: campaign.channel,
    };
  }

  // Если модель вернула не JSON, сохраняем текст как тело сообщения.
  return {
    subject: 'Reaching out to ' + lead.firstName,
    body: text,
    channel: campaign.channel,
  };
}

export type ReplyClass = 'INTERESTED' | 'NOT_INTERESTED' | 'FOLLOW_UP' | 'UNSUBSCRIBE';

function containsAny(value: string, keywords: string[]): boolean {
  return keywords.some((keyword) => value.includes(keyword));
}

// M14-1: demo-классификатор intent + confidence (явные сигналы — высокая уверенность; дефолт — низкая).
function classifyReplyIntentDemo(messageBody: string): { intent: ReplyClass; confidence: number } {
  const text = messageBody.toLowerCase();

  const unsubscribeKeywords = [
    'unsubscribe',
    'opt out',
    'remove me',
    'remove from your list',
    'stop emailing',
    'stop contacting',
    'do not contact',
    "don't contact",
    'abmelden',
    'nicht mehr kontaktieren',
    'entfernen sie mich',
    'отпис',
    'удалите меня',
    'не пишите',
    'больше не пишите',
    'уберите меня',
  ];

  const notInterestedKeywords = [
    'not interested',
    'no interest',
    'not relevant',
    'no thanks',
    'not a fit',
    'we are not looking',
    'keine interesse',
    'kein interesse',
    'nicht interessiert',
    'nicht relevant',
    'nein danke',
    'не интересно',
    'неинтересно',
    'не актуально',
    'не подходит',
    'нет спасибо',
  ];

  const followUpKeywords = [
    'later',
    'next week',
    'next month',
    'follow up',
    'circle back',
    'not now',
    'busy',
    'maybe',
    'später',
    'nächste woche',
    'nächsten monat',
    'gerade beschäftigt',
    'позже',
    'потом',
    'на следующей неделе',
    'в следующем месяце',
    'сейчас занят',
    'сейчас не время',
  ];

  const interestedKeywords = [
    'interested',
    'sounds good',
    'sounds useful',
    'looks interesting',
    'let us talk',
    "let's talk",
    'book a call',
    'schedule',
    'demo',
    'meeting',
    'send more',
    'send me more',
    'more details',
    'tell me more',
    'pricing',
    'price',
    'case study',
    'what does',
    'curious',
    'results',
    'yes',
    'interessiert',
    'klingt gut',
    'termin',
    'demo',
    'gerne',
    'интересно',
    'давайте',
    'созвон',
    'встреч',
    'демо',
    'подробнее',
    'пришлите',
  ];

  if (containsAny(text, unsubscribeKeywords)) {
    return { intent: 'UNSUBSCRIBE', confidence: 0.95 };
  }

  if (containsAny(text, notInterestedKeywords)) {
    return { intent: 'NOT_INTERESTED', confidence: 0.88 };
  }

  // Интерес проверяем РАНЬШE follow-up: «interested … next week» = тёплый ответ.
  if (containsAny(text, interestedKeywords)) {
    return { intent: 'INTERESTED', confidence: 0.85 };
  }

  if (containsAny(text, followUpKeywords)) {
    return { intent: 'FOLLOW_UP', confidence: 0.7 };
  }

  // Нет явных сигналов — низкая уверенность (дефолтный нейтральный класс).
  return { intent: 'FOLLOW_UP', confidence: 0.4 };
}

// Backward-compat: только класс (для прежних вызовов classifyReply).
function classifyReplyDemo(messageBody: string): ReplyClass {
  return classifyReplyIntentDemo(messageBody).intent;
}

/**
 * Классифицирует входящий ответ и определяет следующее действие.
 * В demo-режиме без ANTHROPIC_API_KEY использует простые keyword-эвристики.
 */
export async function classifyReply(messageBody: string): Promise<ReplyClass> {
  if (!llmAvailable()) {
    return classifyReplyDemo(messageBody);
  }

  const prompt = [
    'You are an expert at analyzing B2B sales email replies. Classify the following reply into exactly one category:',
    '',
    '- INTERESTED: The prospect shows interest, asks questions, wants to schedule a call, or responds positively',
    '- NOT_INTERESTED: The prospect clearly declines, says they\'re not interested, or rejects the offer',
    '- FOLLOW_UP: The prospect says they\'re busy, asks to follow up later, or gives a non-committal response',
    '- UNSUBSCRIBE: The prospect asks to be removed from the list, says stop emailing, or is angry about being contacted',
    '',
    'Reply to classify:',
    '"""',
    messageBody,
    '"""',
    '',
    'Respond with ONLY one word from this list: INTERESTED, NOT_INTERESTED, FOLLOW_UP, UNSUBSCRIBE',
  ].join('\n');

  const text = await llmComplete({ prompt, maxTokens: 16, temperature: 0 });
  const validClasses: ReplyClass[] = ['INTERESTED', 'NOT_INTERESTED', 'FOLLOW_UP', 'UNSUBSCRIBE'];
  const result = validClasses.find((c) => text.toUpperCase().includes(c));

  // Нейтральный fallback, если модель вернула неожиданный класс.
  return result ?? 'FOLLOW_UP';
}

/**
 * M14-1: intent-классификация ответа С УВЕРЕННОСТЬЮ (0..1). LLM возвращает класс + confidence;
 * demo-режим — детерминированный класс + эвристический confidence по силе сигналов.
 */
export async function classifyReplyIntent(messageBody: string): Promise<{ intent: ReplyClass; confidence: number }> {
  if (!llmAvailable()) return classifyReplyIntentDemo(messageBody);
  const prompt = [
    'You are an expert at analyzing B2B sales email replies. Classify the reply and rate your confidence.',
    'Categories:',
    '- INTERESTED: shows interest, asks questions, wants a call, positive',
    '- NOT_INTERESTED: clearly declines or rejects the offer',
    '- FOLLOW_UP: busy / later / non-committal',
    '- UNSUBSCRIBE: asks to be removed, stop emailing, or angry about contact',
    '',
    'Reply to classify:',
    '"""', messageBody, '"""',
    '',
    'Respond with ONLY JSON: {"intent":"<one of INTERESTED|NOT_INTERESTED|FOLLOW_UP|UNSUBSCRIBE>","confidence":<number 0..1>}',
  ].join('\n');
  const valid: ReplyClass[] = ['INTERESTED', 'NOT_INTERESTED', 'FOLLOW_UP', 'UNSUBSCRIBE'];
  const res = await llmJson<{ intent?: string; confidence?: number }>({ prompt, maxTokens: 40, temperature: 0 });
  if (!res) return classifyReplyIntentDemo(messageBody); // деградация на эвристику
  const intent = valid.find((c) => (res.intent ?? '').toUpperCase().includes(c)) ?? 'FOLLOW_UP';
  let confidence = typeof res.confidence === 'number' ? res.confidence : 0.6;
  if (confidence > 1) confidence = confidence / 100; // если модель вернула проценты
  confidence = Math.max(0, Math.min(1, confidence));
  return { intent, confidence };
}

function buildDemoAutoReply(params: {
  leadFirstName: string;
  senderName?: string;
  calendlyUrl?: string;
  language?: 'en' | 'ru' | 'de';
}): { subject: string; body: string } {
  const language = params.language ?? 'en';
  const firstName = getFirstName(params.leadFirstName);
  const senderName = params.senderName?.trim() || 'the team';
  const calendlyUrl = params.calendlyUrl?.trim() || config.calendly.url.trim();

  if (language === 'ru') {
    return {
      subject: 'Re: ' + firstName + ', спасибо за ответ',
      body: [
        firstName + ', спасибо за ответ.',
        'Рад, что это актуально.',
        calendlyUrl
          ? 'Можно выбрать удобное время здесь: ' + calendlyUrl
          : 'Можем согласовать удобное время для короткого 20-минутного звонка.',
        senderName,
      ].join('\n\n'),
    };
  }

  if (language === 'de') {
    return {
      subject: 'Re: Danke, ' + firstName,
      body: [
        'Hallo ' + firstName + ', danke für Ihre Rückmeldung.',
        'Freut mich, dass das Thema relevant ist.',
        calendlyUrl
          ? 'Hier können Sie direkt einen passenden Termin auswählen: ' + calendlyUrl
          : 'Wir können gern einen passenden Zeitpunkt für ein kurzes 20-minütiges Gespräch abstimmen.',
        senderName,
      ].join('\n\n'),
    };
  }

  return {
    subject: 'Re: Thanks, ' + firstName,
    body: [
      'Hi ' + firstName + ', thanks for getting back to me.',
      'Glad this is relevant.',
      calendlyUrl
        ? 'You can pick a time that works here: ' + calendlyUrl
        : 'We can find a convenient time for a short 20-minute call.',
      senderName,
    ].join('\n\n'),
  };
}

/**
 * Генерирует ответ на позитивную реакцию лида.
 * В demo-режиме без ANTHROPIC_API_KEY возвращает короткий шаблон.
 */
export async function generateAutoReply(params: {
  leadFirstName: string;
  originalMessage: string;
  replyFromLead: string;
  senderName?: string;
  senderTitle?: string;
  calendlyUrl?: string;
  language?: 'en' | 'ru' | 'de';
}): Promise<{ subject: string; body: string }> {
  if (!llmAvailable()) {
    return buildDemoAutoReply(params);
  }

  const { leadFirstName, originalMessage, replyFromLead, calendlyUrl, language = 'en' } = params;

  const languageInstruction = { en: 'Write in English.', ru: 'Write in Russian.', de: 'Write in German.' }[language];

  const calendlyLine = calendlyUrl
    ? 'Include this scheduling link: ' + calendlyUrl
    : 'Suggest picking a time for a 20-minute call.';

  const prompt = [
    'You are an expert B2B SDR. A lead just responded positively to your cold outreach. Write a short, warm reply to continue the conversation and book a call.',
    '',
    languageInstruction,
    '',
    'Your original message:',
    '"""',
    originalMessage,
    '"""',
    '',
    'Their reply:',
    '"""',
    replyFromLead,
    '"""',
    '',
    'Instructions:',
    '1. Address ' + leadFirstName + ' by first name',
    '2. Acknowledge what they said specifically',
    '3. Keep it under 5 sentences — don\'t oversell',
    '4. ' + calendlyLine,
    '5. Sound like a human, not a robot',
    '6. Write a FINAL, ready-to-send message. Do NOT use placeholders, brackets, or template instructions (no [name], [company], [mention ...], TODO, etc.). If a specific detail is unknown, phrase it generically without brackets.',
    '',
    'Respond with JSON: {"subject": "Re: ...", "body": "full reply text"}',
    'Only valid JSON, no markdown.',
  ].join('\n');

  const text = await llmComplete({ prompt, maxTokens: 512, json: true });
  const parsed = parseJsonLoose<{ subject: string; body: string }>(text);
  return parsed ?? { subject: 'Re: Following up, ' + leadFirstName, body: text };
}

interface LeadProfile {
  title?: string | null;
  company?: string | null;
  companySize?: string | null;
  industry?: string | null;
  country?: string | null;
  email?: string | null;
  linkedinUrl?: string | null;
}

function parseCompanySize(companySize?: string | null): number | null {
  if (!companySize) {
    return null;
  }

  const numbers = companySize.match(/\d+/g)?.map((value) => parseInt(value, 10)).filter((value) => !Number.isNaN(value));

  if (!numbers?.length) {
    return null;
  }

  return Math.max(...numbers);
}

function scoreLeadFromProfileDemo(lead: LeadProfile): number {
  let score = 0;

  if (lead.email?.trim()) score += 25;
  if (lead.linkedinUrl?.trim()) score += 10;
  if (lead.title?.trim()) score += 15;
  if (lead.company?.trim()) score += 15;
  if (lead.country?.trim()) score += 5;

  const title = lead.title?.toLowerCase() ?? '';
  const seniorityKeywords = [
    'founder',
    'co-founder',
    'ceo',
    'chief',
    'cro',
    'vp',
    'vice president',
    'head',
    'director',
    'owner',
    'partner',
    'managing',
    'sales',
    'revenue',
    'основатель',
    'директор',
    'руководитель',
    'продажи',
    'geschäftsführer',
    'leiter',
    'vertrieb',
  ];

  if (containsAny(title, seniorityKeywords)) {
    score += 20;
  }

  const companySize = parseCompanySize(lead.companySize);
  if (companySize !== null) {
    if (companySize >= 10 && companySize <= 500) {
      score += 10;
    } else {
      score += 5;
    }
  }

  const industry = lead.industry?.toLowerCase() ?? '';
  const strongIndustries = [
    'saas',
    'tech',
    'software',
    'consulting',
    'marketing',
    'recruiting',
    'real estate',
    'insurance',
    'immobilien',
    'beratung',
    'versicherung',
    'недвижимость',
    'консалтинг',
    'маркетинг',
    'страхование',
  ];

  if (industry) {
    score += containsAny(industry, strongIndustries) ? 10 : 5;
  }

  return clampScore(score);
}

/**
 * Оценивает лида от 0 до 100 по ICP.
 * В demo-режиме без ANTHROPIC_API_KEY использует детерминированный скоринг.
 */
export async function scoreLeadFromProfile(lead: LeadProfile): Promise<number> {
  if (!llmAvailable()) {
    return scoreLeadFromProfileDemo(lead);
  }

  const leadInfo = [
    lead.title ? 'Title/Role: ' + lead.title : 'Title: unknown',
    lead.company ? 'Company: ' + lead.company : 'Company: unknown',
    lead.companySize ? 'Company size: ' + lead.companySize : 'Company size: unknown',
    lead.industry ? 'Industry: ' + lead.industry : 'Industry: unknown',
    lead.country ? 'Country: ' + lead.country : 'Country: unknown',
    'Has email: ' + (lead.email ? 'yes' : 'no'),
    'Has LinkedIn: ' + (lead.linkedinUrl ? 'yes' : 'no'),
  ].join('\n');

  const prompt = [
    'You are a B2B sales expert. Score this lead from 0 to 100 based on their likelihood to be a good fit for an AI-powered sales automation tool (SDR platform).',
    '',
    'ICP criteria (ideal customer profile):',
    '- Decision makers: VP Sales, Head of Sales, Sales Director, CRO, Founder/CEO of sales-led companies',
    '- Company size: 10-500 employees (sweet spot: 20-150)',
    '- Industries: SaaS, Tech, Consulting, Marketing, Recruiting, Real Estate, Insurance',
    '- Has email address (required for outreach)',
    '- Has LinkedIn profile (bonus)',
    '',
    'Lead profile:',
    leadInfo,
    '',
    'Scoring guide:',
    '- 80-100: Perfect ICP match (decision maker + right company size + good industry + has email)',
    '- 60-79: Good match (most criteria met)',
    '- 40-59: Partial match (some criteria met)',
    '- 20-39: Weak match (few criteria met)',
    '- 0-19: Poor match or missing critical data',
    '',
    'Respond with ONLY a number between 0 and 100. No text, no explanation.',
  ].join('\n');

  const text = await llmComplete({ prompt, maxTokens: 8, temperature: 0 });
  const score = parseInt((text.match(/\d+/)?.[0] ?? '').trim(), 10);
  if (isNaN(score) || score < 0 || score > 100) {
    return 50; // Нейтральный fallback, если модель вернула некорректный скор.
  }

  return clampScore(score);
}