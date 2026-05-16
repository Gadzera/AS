import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';

const llm = new Anthropic({ apiKey: config.ai.apiKey });
const MODEL = 'claude-sonnet-4-6';

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

type SupportedLanguage = 'en' | 'ru' | 'de' | 'fr' | 'es' | 'pt' | 'it' | 'nl' | 'pl';

const LANGUAGE_INSTRUCTIONS: Record<SupportedLanguage, string> = {
  en: 'Write in English.',
  ru: 'Write in Russian.',
  de: 'Write in German.',
  fr: 'Write in French.',
  es: 'Write in Spanish.',
  pt: 'Write in Portuguese.',
  it: 'Write in Italian.',
  nl: 'Write in Dutch.',
  pl: 'Write in Polish.',
};

interface OutreachContext {
  senderName?: string;
  senderTitle?: string;
  senderCompany?: string;
  language?: SupportedLanguage;
  valueProposition?: string;
  tone?: 'professional' | 'casual' | 'friendly';
  websiteContent?: string;
}

export interface GeneratedOutreach {
  subject: string;
  body: string;
  channel: string;
}

export async function generateOutreach(
  lead: LeadContext,
  campaign: CampaignContext,
  context: OutreachContext = {}
): Promise<GeneratedOutreach> {
  const language = context.language ?? 'en';
  const tone = context.tone ?? 'professional';
  const channel = campaign.channel;

  const leadInfo = [
    `Name: ${lead.firstName} ${lead.lastName}`,
    lead.title ? `Title: ${lead.title}` : null,
    lead.company ? `Company: ${lead.company}` : null,
    lead.companySize ? `Company size: ${lead.companySize}` : null,
    lead.industry ? `Industry: ${lead.industry}` : null,
    lead.country ? `Location: ${lead.city ? lead.city + ', ' : ''}${lead.country}` : null,
    lead.website ? `Website: ${lead.website}` : null,
  ].filter(Boolean).join('\n');

  const senderInfo = [
    context.senderName ? `Sender name: ${context.senderName}` : null,
    context.senderTitle ? `Sender title: ${context.senderTitle}` : null,
    context.senderCompany ? `Sender company: ${context.senderCompany}` : null,
    context.valueProposition ? `Value proposition: ${context.valueProposition}` : null,
  ].filter(Boolean).join('\n');

  const languageInstruction = LANGUAGE_INSTRUCTIONS[language as SupportedLanguage] ?? LANGUAGE_INSTRUCTIONS.en;
  const channelInstruction = channel === 'LINKEDIN'
    ? 'This is a LinkedIn connection request / InMail message. Keep it under 300 characters for the connection note, or under 1000 characters for InMail. No formal subject line needed.'
    : 'This is a cold email. Include a compelling subject line and a well-structured body (3-5 short paragraphs).';

  const websiteSnippet = context.websiteContent
    ? `\nLead's company website content:\n"""\n${context.websiteContent}\n"""`
    : '';

  const prompt = `You are an expert B2B sales development representative (SDR). Write a highly personalized ${channel === 'LINKEDIN' ? 'LinkedIn' : 'email'} outreach message.

${channelInstruction}
${languageInstruction}
Tone: ${tone}
Campaign: ${campaign.name}

Lead information:
${leadInfo}

${senderInfo ? `Sender information:\n${senderInfo}` : ''}
${websiteSnippet}
Requirements:
1. Personalize the message based on the lead's company, industry, and role
2. Focus on their specific pain points and how you can help
3. Be concise and value-focused — no fluff
4. Include a clear, low-friction call to action (e.g., "Would you be open to a 15-minute call?")
5. Do NOT use generic phrases like "I hope this finds you well" or "I wanted to reach out"
6. Reference something specific about their company or industry

${channel === 'LINKEDIN'
    ? 'Respond with JSON: {"subject": "", "body": "the LinkedIn message text"}'
    : 'Respond with JSON: {"subject": "email subject line", "body": "full email body with line breaks as \\n"}'
}

Only respond with valid JSON, no markdown, no extra text.`;

  const response = await llm.messages.create({ model: MODEL, max_tokens: 1024, messages: [{ role: 'user', content: prompt }] });
  const content = response.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response');

  try {
    const parsed = JSON.parse(content.text.trim());
    return { subject: parsed.subject ?? '', body: parsed.body ?? '', channel: campaign.channel };
  } catch {
    return { subject: `Reaching out to ${lead.firstName}`, body: content.text, channel: campaign.channel };
  }
}

export type ReplyClass = 'INTERESTED' | 'NOT_INTERESTED' | 'FOLLOW_UP' | 'UNSUBSCRIBE';

export async function classifyReply(messageBody: string): Promise<ReplyClass> {
  const prompt = `Classify this B2B sales email reply into exactly one category:
- INTERESTED: shows interest, asks questions, wants to schedule a call
- NOT_INTERESTED: clearly declines or rejects
- FOLLOW_UP: busy, asks to follow up later, non-committal
- UNSUBSCRIBE: asks to be removed, angry about contact

Reply:
"""
${messageBody}
"""

Respond with ONLY one word: INTERESTED, NOT_INTERESTED, FOLLOW_UP, UNSUBSCRIBE`;

  const response = await llm.messages.create({ model: MODEL, max_tokens: 16, messages: [{ role: 'user', content: prompt }] });
  const content = response.content[0];
  if (content.type !== 'text') return 'FOLLOW_UP';

  const result = content.text.trim().toUpperCase() as ReplyClass;
  const valid: ReplyClass[] = ['INTERESTED', 'NOT_INTERESTED', 'FOLLOW_UP', 'UNSUBSCRIBE'];
  return valid.includes(result) ? result : 'FOLLOW_UP';
}

export async function generateAutoReply(params: {
  leadFirstName: string;
  originalMessage: string;
  replyFromLead: string;
  senderName?: string;
  senderTitle?: string;
  calendlyUrl?: string;
  language?: SupportedLanguage | string;
}): Promise<{ subject: string; body: string }> {
  const { leadFirstName, originalMessage, replyFromLead, calendlyUrl, language = 'en' } = params;
  const languageInstruction = LANGUAGE_INSTRUCTIONS[language as SupportedLanguage] ?? LANGUAGE_INSTRUCTIONS.en;
  const calendlyLine = calendlyUrl ? `Include this scheduling link: ${calendlyUrl}` : 'Suggest picking a time for a 20-minute call.';

  const prompt = `You are an expert B2B SDR. A lead responded positively. Write a short warm reply to book a call.
${languageInstruction}

Original message: """${originalMessage}"""
Their reply: """${replyFromLead}"""

Instructions:
1. Address ${leadFirstName} by first name
2. Acknowledge what they said specifically
3. Keep it under 5 sentences
4. ${calendlyLine}

Respond with JSON: {"subject": "Re: ...", "body": "full reply text"}
Only valid JSON, no markdown.`;

  const response = await llm.messages.create({ model: MODEL, max_tokens: 512, messages: [{ role: 'user', content: prompt }] });
  const content = response.content[0];
  if (content.type !== 'text') return { subject: `Re: Following up, ${leadFirstName}`, body: '' };

  try {
    return JSON.parse(content.text.trim()) as { subject: string; body: string };
  } catch {
    return { subject: `Re: Following up, ${leadFirstName}`, body: content.text };
  }
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

export async function scoreLeadFromProfile(lead: LeadProfile): Promise<number> {
  const leadInfo = [
    lead.title ? `Title: ${lead.title}` : 'Title: unknown',
    lead.company ? `Company: ${lead.company}` : 'Company: unknown',
    lead.companySize ? `Size: ${lead.companySize}` : 'Size: unknown',
    lead.industry ? `Industry: ${lead.industry}` : 'Industry: unknown',
    lead.country ? `Country: ${lead.country}` : 'Country: unknown',
    `Has email: ${lead.email ? 'yes' : 'no'}`,
    `Has LinkedIn: ${lead.linkedinUrl ? 'yes' : 'no'}`,
  ].join('\n');

  const prompt = `Score this B2B lead from 0-100 for fit with an SDR automation platform.

ICP: VP/Head of Sales, Director, CRO, Founder; 10-500 employees; SaaS/Tech/Consulting/Marketing.

Profile:
${leadInfo}

Respond with ONLY a number 0-100.`;

  const response = await llm.messages.create({ model: MODEL, max_tokens: 8, messages: [{ role: 'user', content: prompt }] });
  const content = response.content[0];
  if (content.type !== 'text') return 50;

  const score = parseInt(content.text.trim(), 10);
  return isNaN(score) || score < 0 || score > 100 ? 50 : score;
}
