import axios from 'axios';
import * as cheerio from 'cheerio';
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

// Безопасная проверка что URL не внутренний
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

// Поиск через DuckDuckGo HTML (без API ключа)
async function searchDuckDuckGo(query: string, maxResults = 10): Promise<string[]> {
  const urls: string[] = [];
  try {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const resp = await axios.get<string>(searchUrl, {
      timeout: 10_000,
      maxContentLength: 500_000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ResearchBot/1.0)',
        Accept: 'text/html',
      },
    });

    const $ = cheerio.load(resp.data);
    $('a.result__url, a[href*="uddg="]').each((_i, el) => {
      if (urls.length >= maxResults) return false;
      const href = $(el).attr('href') ?? '';
      // DuckDuckGo обёртывает результаты в /l/?uddg=...
      const match = href.match(/uddg=([^&]+)/);
      if (match) {
        try {
          const decoded = decodeURIComponent(match[1]);
          if (isPublicUrl(decoded)) urls.push(decoded);
        } catch { /* skip */ }
      } else if (isPublicUrl(href)) {
        urls.push(href);
      }
    });
  } catch (err) {
    console.error('[WebProspector] Search error:', (err as Error).message);
  }
  return urls;
}

// Извлечь email с сайта
async function extractEmailsFromSite(siteUrl: string): Promise<string[]> {
  const emails = new Set<string>();
  const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

  // Страницы где обычно есть контакты
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

      // Email из mailto: ссылок
      $('a[href^="mailto:"]').each((_i, el) => {
        const href = $(el).attr('href') ?? '';
        const email = href.replace('mailto:', '').split('?')[0].trim().toLowerCase();
        if (email && !email.includes('example') && !email.includes('domain')) {
          emails.add(email);
        }
      });

      // Email из текста
      const text = $.text();
      const found = text.match(EMAIL_RE) ?? [];
      for (const e of found) {
        const lower = e.toLowerCase();
        if (!lower.includes('example') && !lower.includes('@2x') && !lower.endsWith('.png') && !lower.endsWith('.jpg')) {
          emails.add(lower);
        }
      }

      if (emails.size > 0) break; // нашли — дальше не идём
    } catch { /* страница недоступна — пропустить */ }
  }

  return [...emails].slice(0, 5); // max 5 email с одного сайта
}

// Определить домен компании из URL
function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// Попытаться определить название компании из сайта
async function extractCompanyName(siteUrl: string): Promise<string> {
  try {
    const resp = await axios.get<string>(siteUrl, {
      timeout: 5_000,
      maxContentLength: 100_000,
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' },
    });
    const $ = cheerio.load(resp.data);
    // Из <title>
    const title = $('title').text().trim();
    if (title) return title.split(/[|\-–—]/)[0].trim().slice(0, 100);
    // Из og:site_name
    const ogSite = $('meta[property="og:site_name"]').attr('content') ?? '';
    if (ogSite) return ogSite.trim().slice(0, 100);
  } catch { /* ignore */ }
  return getDomain(siteUrl);
}

// Угадать имя из email
function guessNameFromEmail(email: string): { firstName: string; lastName: string } {
  const local = email.split('@')[0];
  // john.doe → John Doe
  const parts = local.split(/[.\-_]/).filter(p => p.length > 1 && /^[a-z]+$/i.test(p));
  if (parts.length >= 2) {
    return { firstName: capitalize(parts[0]), lastName: capitalize(parts[1]) };
  }
  if (parts.length === 1) {
    return { firstName: capitalize(parts[0]), lastName: '' };
  }
  return { firstName: 'Contact', lastName: '' };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

// Является ли email роль-адресом (не персональным)
function isRoleEmail(email: string): boolean {
  const roleNames = ['info', 'contact', 'hello', 'support', 'admin', 'sales', 'marketing',
    'team', 'office', 'mail', 'no-reply', 'noreply', 'help', 'careers', 'press', 'hr'];
  const local = email.split('@')[0].toLowerCase();
  return roleNames.some(r => local === r || local.startsWith(r + '.') || local.startsWith(r + '-'));
}

// Основная функция поиска лидов
export async function prospectFromWeb(params: {
  keywords:     string[];
  industry?:    string | null;
  country?:     string | null;
  titles?:      string[];
  limit:        number;
}): Promise<ProspectLead[]> {
  const { keywords, industry, country, titles, limit } = params;

  const query = [
    ...keywords,
    industry,
    country,
    titles?.length ? `(${titles.slice(0, 3).join(' OR ')})` : null,
    'contact email',
  ].filter(Boolean).join(' ');

  console.log(`[WebProspector] Searching: ${query}`);

  const siteUrls = await searchDuckDuckGo(query, Math.min(limit * 3, 30));
  const results: ProspectLead[] = [];
  const seenDomains = new Set<string>();
  const seenEmails  = new Set<string>();

  for (const siteUrl of siteUrls) {
    if (results.length >= limit) break;

    const domain = getDomain(siteUrl);
    if (seenDomains.has(domain)) continue;
    seenDomains.add(domain);

    const [emails, companyName] = await Promise.all([
      extractEmailsFromSite(siteUrl),
      extractCompanyName(siteUrl),
    ]);

    if (emails.length === 0) continue;

    // Предпочитаем персональные email, но берём и роль-адреса если ничего нет
    const personal = emails.filter(e => !isRoleEmail(e));
    const chosen   = personal.length > 0 ? personal[0] : emails[0];

    if (seenEmails.has(chosen)) continue;
    seenEmails.add(chosen);

    const { firstName, lastName } = guessNameFromEmail(chosen);

    results.push({
      firstName,
      lastName,
      email: chosen,
      company: companyName,
      website: siteUrl,
      industry: industry ?? undefined,
      country:  country  ?? undefined,
      title:    titles?.[0] ?? undefined,
      source:   'web-prospector',
    });
  }

  console.log(`[WebProspector] Found ${results.length} prospects`);
  return results;
}

// Импортировать найденных лидов в БД и добавить в кампанию
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
      // Проверить дубли
      if (p.email) {
        const exists = await prisma.lead.findFirst({ where: { orgId, email: p.email } });
        if (exists) { skipped++; continue; }
      }

      const score = scoreLeadSync({ title: p.title, companySize: undefined, industry: p.industry });

      const lead = await prisma.lead.create({
        data: {
          orgId,
          firstName:       p.firstName,
          lastName:        p.lastName,
          email:           p.email,
          company:         p.company,
          website:         p.website,
          title:           p.title  ?? null,
          industry:        p.industry ?? null,
          country:         p.country  ?? null,
          source:          p.source,
          score,
          unsubscribeToken: generateUnsubscribeToken(),
        },
      });

      // Добавить в кампанию
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
          }).catch(() => null); // игнорировать дубли
        }
      }

      // Обновить счётчик автопилота
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
