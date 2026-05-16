import axios from 'axios';
import { config } from '../config';

const PDL_BASE = 'https://api.peopledatalabs.com/v5';

export interface PDLPersonResult {
  firstName:   string;
  lastName:    string;
  email:       string | null;
  linkedinUrl: string | null;
  title:       string | null;
  company:     string | null;
  companySize: string | null;
  industry:    string | null;
  country:     string | null;
  city:        string | null;
  website:     string | null;
  pdlId:       string;
}

export interface PDLSearchParams {
  jobTitles?:   string[];
  countries?:   string[];
  industries?:  string[];
  companySizes?: string[]; // e.g. ['11-50', '51-200']
  keywords?:    string;
  page?:        number;
  size?:        number;  // max 100
}

export async function searchPDL(params: PDLSearchParams): Promise<{ results: PDLPersonResult[]; total: number }> {
  if (!config.pdl.apiKey) {
    throw new Error('PDL_API_KEY is not configured');
  }

  // Build SQL query for PDL's person search
  const conditions: string[] = [];

  if (params.jobTitles?.length) {
    const titles = params.jobTitles.map(t => `'${t.replace(/'/g, "''")}'`).join(', ');
    conditions.push(`job_title IN (${titles})`);
  }
  if (params.countries?.length) {
    const countries = params.countries.map(c => `'${c.replace(/'/g, "''")}'`).join(', ');
    conditions.push(`location_country IN (${countries})`);
  }
  if (params.industries?.length) {
    const industries = params.industries.map(i => `'${i.replace(/'/g, "''")}'`).join(', ');
    conditions.push(`industry IN (${industries})`);
  }
  if (params.companySizes?.length) {
    const sizes = params.companySizes.map(s => `'${s}'`).join(', ');
    conditions.push(`company_size IN (${sizes})`);
  }
  if (params.keywords) {
    conditions.push(`skills LIKE '%${params.keywords.replace(/'/g, "''")}%'`);
  }

  // Always require work email
  conditions.push("work_email IS NOT NULL");

  const sql = `SELECT * FROM person WHERE ${conditions.join(' AND ')} LIMIT ${params.size ?? 25}`;

  const response = await axios.post(
    `${PDL_BASE}/person/search`,
    { sql, dataset: 'all' },
    {
      headers: {
        'X-Api-Key': config.pdl.apiKey,
        'Content-Type': 'application/json',
      },
      params: {
        scroll_token: params.page && params.page > 1 ? undefined : undefined,
      },
    }
  );

  const { data } = response.data as { data: any[]; total: number };

  const results: PDLPersonResult[] = (data ?? []).map((p: any) => ({
    firstName:   p.first_name ?? '',
    lastName:    p.last_name ?? '',
    email:       p.work_email ?? p.emails?.[0]?.address ?? null,
    linkedinUrl: p.linkedin_url ?? null,
    title:       p.job_title ?? null,
    company:     p.job_company_name ?? null,
    companySize: p.job_company_size ?? null,
    industry:    p.industry ?? null,
    country:     p.location_country ?? null,
    city:        p.location_locality ?? null,
    website:     p.job_company_website ?? null,
    pdlId:       p.id,
  }));

  return { results, total: response.data.total ?? results.length };
}
