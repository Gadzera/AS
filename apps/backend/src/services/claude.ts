import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';

const anthropic = new Anthropic({
  apiKey: config.anthropic.apiKey,
});

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

interface OutreachContext {
  senderName?: string;
  senderTitle?: string;
  senderCompany?: string;
  language?: 'en' | 'ru' | 'de';
  valueProposition?: string;
  tone?: 'professional' | 'casual' | 'friendly';
}

export interface GeneratedOutreach {
  subject: string;
  body: string;
  channel: string;
}

/**
 * Generate personalized outreach message using Claude AI
 */
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
  ]
    .filter(Boolean)
    .join('\n');

  const senderInfo = [
    context.senderName ? `Sender name: ${context.senderName}` : null,
    context.senderTitle ? `Sender title: ${context.senderTitle}` : null,
    context.senderCompany ? `Sender company: ${context.senderCompany}` : null,
    context.valueProposition ? `Value proposition: ${context.valueProposition}` : null,
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

  const prompt = `You are an expert B2B sales development representative (SDR). Your task is to write a highly personalized ${channel === 'LINKEDIN' ? 'LinkedIn' : 'email'} outreach message.

${channelInstruction}
${languageInstruction}
Tone: ${tone}
Campaign: ${campaign.name}

Lead information:
${leadInfo}

${senderInfo ? `Sender information:\n${senderInfo}` : ''}

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

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  try {
    const parsed = JSON.parse(content.text.trim());
    return {
      subject: parsed.subject ?? '',
      body: parsed.body ?? '',
      channel: campaign.channel,
    };
  } catch {
    // Fallback: return raw text as body
    return {
      subject: `Reaching out to ${lead.firstName}`,
      body: content.text,
      channel: campaign.channel,
    };
  }
}

export type ReplyClass = 'INTERESTED' | 'NOT_INTERESTED' | 'FOLLOW_UP' | 'UNSUBSCRIBE';

/**
 * Classify an incoming reply to determine next action
 */
export async function classifyReply(messageBody: string): Promise<ReplyClass> {
  const prompt = `You are an expert at analyzing B2B sales email replies. Classify the following reply into exactly one category:

- INTERESTED: The prospect shows interest, asks questions, wants to schedule a call, or responds positively
- NOT_INTERESTED: The prospect clearly declines, says they're not interested, or rejects the offer
- FOLLOW_UP: The prospect says they're busy, asks to follow up later, or gives a non-committal response
- UNSUBSCRIBE: The prospect asks to be removed from the list, says stop emailing, or is angry about being contacted

Reply to classify:
"""
${messageBody}
"""

Respond with ONLY one word from this list: INTERESTED, NOT_INTERESTED, FOLLOW_UP, UNSUBSCRIBE`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 16,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  const result = content.text.trim().toUpperCase() as ReplyClass;
  const validClasses: ReplyClass[] = ['INTERESTED', 'NOT_INTERESTED', 'FOLLOW_UP', 'UNSUBSCRIBE'];

  if (validClasses.includes(result)) {
    return result;
  }

  // Default fallback
  return 'FOLLOW_UP';
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

/**
 * Score a lead from 0-100 based on ICP (Ideal Customer Profile) match
 */
export async function scoreLeadFromProfile(lead: LeadProfile): Promise<number> {
  const leadInfo = [
    lead.title ? `Title/Role: ${lead.title}` : 'Title: unknown',
    lead.company ? `Company: ${lead.company}` : 'Company: unknown',
    lead.companySize ? `Company size: ${lead.companySize}` : 'Company size: unknown',
    lead.industry ? `Industry: ${lead.industry}` : 'Industry: unknown',
    lead.country ? `Country: ${lead.country}` : 'Country: unknown',
    `Has email: ${lead.email ? 'yes' : 'no'}`,
    `Has LinkedIn: ${lead.linkedinUrl ? 'yes' : 'no'}`,
  ].join('\n');

  const prompt = `You are a B2B sales expert. Score this lead from 0 to 100 based on their likelihood to be a good fit for an AI-powered sales automation tool (SDR platform).

ICP criteria (ideal customer profile):
- Decision makers: VP Sales, Head of Sales, Sales Director, CRO, Founder/CEO of sales-led companies
- Company size: 10-500 employees (sweet spot: 20-150)
- Industries: SaaS, Tech, Consulting, Marketing, Recruiting, Real Estate, Insurance
- Has email address (required for outreach)
- Has LinkedIn profile (bonus)

Lead profile:
${leadInfo}

Scoring guide:
- 80-100: Perfect ICP match (decision maker + right company size + good industry + has email)
- 60-79: Good match (most criteria met)
- 40-59: Partial match (some criteria met)
- 20-39: Weak match (few criteria met)
- 0-19: Poor match or missing critical data

Respond with ONLY a number between 0 and 100. No text, no explanation.`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  const score = parseInt(content.text.trim(), 10);
  if (isNaN(score) || score < 0 || score > 100) {
    return 50; // Default neutral score
  }

  return score;
}
