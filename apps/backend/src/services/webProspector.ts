import axios from 'axios';
import * as cheerio from 'cheerio';
import * as dns from 'dns/promises';
import { prisma } from '../lib/prisma';
import { generateUnsubscribeToken } from '../utils/unsubscribe';
import { scoreLeadSync } from './scorer';

export interface ProspectLead {
  firstName:  string;
  lastName:   string;
  email:      string;
  company:    string;
  website:    string;
  title?:     string;
  industry?:  string;
  country?:   string;
  source:     string;
}

function isPublicUrl(urlStr: string): boolean {
  try {
    const { hostname, protocol } = new URL(urlStr);
    if (!['http:', 'https:'].includes(protocol)) return false;
    if (['localhost', '::1'].includes(hostname)) return false;
    if (/^127\./.test(hostname)) return false;
    if (/^10\./.test(hostname)) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return false;
    if (/^192\.168\./.test(hostname)) return false;
    if (/^169\.254\./.test(hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function isRoleEmail(email: string): boolean {
  const roleNames = ['info', 'contact', 'hello', 'support', 'admin', 'sales', 'marketing',
    'team', 'office', 'mail', 'no-reply', 'noreply', 'help', 'careers', 'press', 'hr'];
  const local = email.split('@')[0].toLowerCase();
  return roleNames.some(r => local === r || local.startsWith(r + '.') || local.startsWith(r + '-'));
}

function guessNameFromEmail(email: string): { firstName: string; lastName: string } {
  const local = email.split('@')[0];
  const parts = local.split(/[.\-_]/).filter(p => p.length > 1 && /^[a-z]+$/i.test(p));
  if (parts.length >= 2) return { firstName: capitalize(parts[0]), lastName: capitalize(parts[1]) };
  if (parts.length === 1) return { firstName: capitalize(parts[0]), lastName: '' };
  return { firstName: 'Contact', lastName: '' };
}

// ─── Стратегия 1: Прямая добыча email со страниц сайта ───────────────────────

async function extractEmailsFromSite(siteUrl: string): Promise<string[]> {
  const emails = new Set<string>();
  const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const paths = ['', '/contact', '/contact-us', '/about', '/team', '/about-us'];

  for (const path of paths) {
    try {
      const url = new URL(path, siteUrl).toString();
      const resp = await axios.get<string>(url, {
        timeout: 6_000,
        maxContentLength: 200_000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ResearchBot/1.0)', Accept: 'text/html' },
        validateStatus: s => s < 400,
      });

      const html = typeof resp.data === 'string' ? resp.data : '';
      const $ = cheerio.load(html);

      $('a[href^="mailto:"]').each((_i, el) => {
        const href = $(el).attr('href') ?? '';
        const email = href.replace('mailto:', '').split('?')[0].trim().toLowerCase();
        if (email && !email.includes('example') && !email.includes('domain')) emails.add(email);
      });

      const text = $.text();
      for (const e of (text.match(EMAIL_RE) ?? [])) {
        const lower = e.toLowerCase();
        if (!lower.includes('example') && !lower.includes('@2x') && !lower.endsWith('.png') && !lower.endsWith('.jpg')) {
          emails.add(lower);
        }
      }

      if (emails.size > 0) break;
    } catch { /* страница недоступна */ }
  }

  return [...emails].slice(0, 5);
}

// ─── Стратегия 2: Генерация шаблонов email + DNS-валидация ───────────────────

const mxCache = new Map<string, boolean>();

async function hasMxRecord(domain: string): Promise<boolean> {
  if (mxCache.has(domain)) return mxCache.get(domain)!;
  try {
    const records = await Promise.race([
      dns.resolveMx(domain),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 3_000)),
    ]);
    const ok = records.length > 0;
    mxCache.set(domain, ok);
    return ok;
  } catch {
    mxCache.set(domain, false);
    return false;
  }
}

function generateEmailPatterns(firstName: string, lastName: string, domain: string): string[] {
  const f = firstName.toLowerCase().replace(/[^a-z]/g, '');
  const l = lastName.toLowerCase().replace(/[^a-z]/g, '');
  if (!f) return [];

  const patterns: string[] = [];
  if (l) {
    patterns.push(`${f}.${l}@${domain}`);
    patterns.push(`${f}${l}@${domain}`);
    patterns.push(`${f[0]}.${l}@${domain}`);
    patterns.push(`${f[0]}${l}@${domain}`);
    patterns.push(`${f}@${domain}`);
    patterns.push(`${l}@${domain}`);
  } else {
    patterns.push(`${f}@${domain}`);
  }
  return patterns;
}

async function tryEmailPatterns(
  firstName: string,
  lastName: string,
  domain: string
): Promise<string | null> {
  if (!await hasMxRecord(domain)) return null;

  const patterns = generateEmailPatterns(firstName, lastName, domain);
  // Вернуть первый шаблон с персональным именем (нет гарантии доставки, но паттерн валиден)
  for (const email of patterns) {
    if (!isRoleEmail(email)) return email;
  }
  return null;
}

// ─── Стратегия 3: Поиск персон через LinkedIn/DuckDuckGo ─────────────────────

async function searchLinkedInProfiles(
  companyName: string,
  titles: string[],
  domain: string
): Promise<{ firstName: string; lastName: string; title?: string } | null> {
  try {
    const titleQuery = titles.length > 0 ? titles.slice(0, 2).join(' OR ') : 'CEO OR founder OR director';
    const query = `site:linkedin.com/in "${companyName}" (${titleQuery})`;
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    const resp = await axios.get<string>(searchUrl, {
      timeout: 10_000,
      maxContentLength: 300_000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ResearchBot/1.0)', Accept: 'text/html' },
    });

    const $ = cheerio.load(resp.data);
    let found: { firstName: string; lastName: string; title?: string } | null = null;

    $('a.result__a').each((_i, el) => {
      if (found) return false;
      const href = $(el).attr('href') ?? '';
      if (!href.includes('linkedin.com/in/')) return;

      const text = $(el).text().trim();
      // Типичный формат: "Имя Фамилия - Должность в Компания"
      const namePart = text.split(/[-–|]/)[0].trim();
      const words = namePart.split(/\s+/).filter(w => /^[A-Za-zА-Яа-яёЁ'-]+$/.test(w));

      if (words.length >= 2) {
        found = { firstName: words[0], lastName: words[1] };
        // Попытаться извлечь должность
        const afterDash = text.split(/[-–]/)[1]?.trim() ?? '';
        if (afterDash) found.title = afterDash.split(' at ')[0].split(' в ')[0].trim().slice(0, 60);
      }
    });

    return found;
  } catch {
    return null;
  }
}

// ─── Главный оркестратор с challenge-retry ────────────────────────────────────

interface EmailResult {
  email: string;
  firstName: string;
  lastName: string;
  title?: string;
  strategy: 1 | 2 | 3;
}

async function findEmailWithRetry(
  siteUrl: string,
  companyName: string,
  targetTitles: string[]
): Promise<EmailResult | null> {
  const domain = getDomain(siteUrl);

  // === Стратегия 1: Прямое извлечение ===
  const extracted = await extractEmailsFromSite(siteUrl);
  if (extracted.length > 0) {
    const personal = extracted.filter(e => !isRoleEmail(e));
    const chosen = personal.length > 0 ? personal[0] : extracted[0];
    const { firstName, lastName } = guessNameFromEmail(chosen);
    console.log(`[WebProspector] Strategy 1 succeeded for ${domain}: ${chosen}`);
    return { email: chosen, firstName, lastName, strategy: 1 };
  }

  console.log(`[WebProspector] Strategy 1 failed for ${domain}, trying strategy 2...`);

  // === Стратегия 2: LinkedIn → email паттерны ===
  const person = await searchLinkedInProfiles(companyName, targetTitles, domain);
  if (person) {
    const guessed = await tryEmailPatterns(person.firstName, person.lastName, domain);
    if (guessed) {
      console.log(`[WebProspector] Strategy 2 succeeded for ${domain}: ${guessed} (${person.firstName} ${person.lastName})`);
      return {
        email: guessed,
        firstName: person.firstName,
        lastName: person.lastName,
        title: person.title,
        strategy: 2,
      };
    }
  }

  console.log(`[WebProspector] Strategy 2 failed for ${domain}, trying strategy 3...`);

  // === Стратегия 3: Резервный — role email если домен принимает почту ===
  if (await hasMxRecord(domain)) {
    // Берём наиболее вероятный публичный адрес — это лучше чем ничего
    const fallbackEmail = `contact@${domain}`;
    console.log(`[WebProspector] Strategy 3 fallback for ${domain}: ${fallbackEmail}`);
    return {
      email: fallbackEmail,
      firstName: companyName.split(/\s+/)[0] || 'Contact',
      lastName: '',
      strategy: 3,
    };
  }

  console.log(`[WebProspector] All strategies failed for ${domain} (no MX record)`);
  return null;
}

// ─── DuckDuckGo поиск ─────────────────────────────────────────────────────────

async function searchDuckDuckGo(query: string, maxResults = 10): Promise<string[]> {
  const urls: string[] = [];
  try {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const resp = await axios.get<string>(searchUrl, {
      timeout: 10_000,
      maxContentLength: 500_000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ResearchBot/1.0)', Accept: 'text/html' },
    });

    const $ = cheerio.load(resp.data);
    $('a.result__url, a[href*="uddg="]').each((_i, el) => {
      if (urls.length >= maxResults) return false;
      const href = $(el).attr('href') ?? '';
      const match = href.match(/uddg=([^&]+)/);
      if (match) {
        try {
          const decoded = decodeURIComponent(match[1]);
          if (isPublicUrl(decoded) && !decoded.includes('linkedin.com') && !decoded.includes('facebook.com')) {
            urls.push(decoded);
          }
        } catch { /* skip */ }
      } else if (isPublicUrl(href) && !href.includes('linkedin.com') && !href.includes('facebook.com')) {
        urls.push(href);
      }
    });
  } catch (err) {
    console.error('[WebProspector] Search error:', (err as Error).message);
  }
  return urls;
}

async function extractCompanyName(siteUrl: string): Promise<string> {
  try {
    const resp = await axios.get<string>(siteUrl, {
      timeout: 5_000,
      maxContentLength: 100_000,
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' },
    });
    const $ = cheerio.load(resp.data);
    const title = $('title').text().trim();
    if (title) return title.split(/[|\-–—]/)[0].trim().slice(0, 100);
    const ogSite = $('meta[property="og:site_name"]').attr('content') ?? '';
    if (ogSite) return ogSite.trim().slice(0, 100);
  } catch { /* ignore */ }
  return getDomain(siteUrl);
}

// ─── Публичные экспорты ────────────────────────────────────────────────────────

export async function prospectFromWeb(params: {
  keywords:  string[];
  industry?: string | null;
  country?:  string | null;
  titles?:   string[];
  limit:     number;
}): Promise<ProspectLead[]> {
  const { keywords, industry, country, titles = [], limit } = params;

  const query = [
    ...keywords,
    industry,
    country,
    titles.length ? `(${titles.slice(0, 3).join(' OR ')})` : null,
    'company site',
  ].filter(Boolean).join(' ');

  console.log(`[WebProspector] Searching: ${query}`);

  const siteUrls = await searchDuckDuckGo(query, Math.min(limit * 4, 40));
  const results: ProspectLead[] = [];
  const seenDomains = new Set<string>();
  const seenEmails  = new Set<string>();

  for (const siteUrl of siteUrls) {
    if (results.length >= limit) break;

    const domain = getDomain(siteUrl);
    if (seenDomains.has(domain)) continue;
    seenDomains.add(domain);

    const companyName = await extractCompanyName(siteUrl);

    // Многостратегийный поиск email — всегда пытается добиться результата
    const found = await findEmailWithRetry(siteUrl, companyName, titles);
    if (!found) continue;

    if (seenEmails.has(found.email)) continue;
    seenEmails.add(found.email);

    results.push({
      firstName: found.firstName,
      lastName:  found.lastName,
      email:     found.email,
      company:   companyName,
      website:   siteUrl,
      industry:  industry ?? undefined,
      country:   country  ?? undefined,
      title:     found.title ?? titles[0] ?? undefined,
      source:    `web-prospector-s${found.strategy}`,
    });
  }

  console.log(`[WebProspector] Found ${results.length} prospects from ${seenDomains.size} sites`);
  return results;
}

export async function importProspectsToOrg(params: {
  orgId:      string;
  campaignId: string | null | undefined;
  prospects:  ProspectLead[];
}): Promise<{ imported: number; skipped: number }> {
  const { orgId, campaignId, prospects } = params;
  let imported = 0;
  let skipped  = 0;

  for (const p of prospects) {
    try {
      if (p.email) {
        const exists = await prisma.lead.findFirst({ where: { orgId, email: p.email } });
        if (exists) { skipped++; continue; }
      }

      const score = scoreLeadSync({ title: p.title, companySize: undefined, industry: p.industry });

      const lead = await prisma.lead.create({
        data: {
          orgId,
          firstName:        p.firstName,
          lastName:         p.lastName,
          email:            p.email,
          company:          p.company,
          website:          p.website,
          title:            p.title    ?? null,
          industry:         p.industry ?? null,
          country:          p.country  ?? null,
          source:           p.source,
          score,
          unsubscribeToken: generateUnsubscribeToken(),
        },
      });

      if (campaignId) {
        const campaign = await prisma.campaign.findFirst({
          where: { id: campaignId, orgId },
          include: { sequences: { orderBy: { stepNumber: 'asc' }, take: 1 } },
        });
        if (campaign) {
          const firstStep  = campaign.sequences[0];
          const delayMs    = firstStep ? firstStep.delayDays * 86_400_000 : 0;
          const nextSendAt = new Date(Date.now() + delayMs);
          await prisma.campaignLead.create({
            data: { campaignId, leadId: lead.id, currentStep: 0, status: 'NEW', nextSendAt },
          }).catch(() => null);
        }
      }

      await prisma.autopilotConfig.updateMany({
        where: { orgId, enabled: true },
        data: { totalDiscovered: { increment: 1 } },
      }).catch(() => null);

      imported++;
    } catch (err) {
      console.error('[WebProspector] Import error:', (err as Error).message);
      skipped++;
    }
  }

  return { imported, skipped };
}
