import axios, { AxiosError } from 'axios';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import { decrypt } from '../utils/encryption';

interface LeadPayload {
  email?: string | null;
  firstName: string;
  lastName: string;
  company?: string | null;
  title?: string | null;
  orgId?: string | null;
}

async function resolveCreds(orgId?: string | null): Promise<{ apiKey: string; domain: string } | null> {
  if (orgId) {
    const [keyEntry, domainEntry] = await Promise.all([
      prisma.apiKey.findFirst({ where: { orgId, service: 'pipedrive_key' } }),
      prisma.apiKey.findFirst({ where: { orgId, service: 'pipedrive_domain' } }),
    ]);
    if (keyEntry && domainEntry) {
      return { apiKey: decrypt(keyEntry.keyValue), domain: domainEntry.keyValue };
    }
  }
  if (config.pipedrive.apiKey && config.pipedrive.domain) {
    return { apiKey: config.pipedrive.apiKey, domain: config.pipedrive.domain };
  }
  return null;
}

export async function upsertPipedriveContact(lead: LeadPayload): Promise<void> {
  const creds = await resolveCreds(lead.orgId);
  if (!creds) return;

  const base = `https://${creds.domain}.pipedrive.com/api/v1`;
  const params = { api_token: creds.apiKey };

  try {
    if (lead.email) {
      const search = await axios.get(`${base}/persons/search`, {
        params: { ...params, term: lead.email, fields: 'email', exact_match: true, limit: 1 },
        timeout: 10_000,
      });

      const existing = search.data?.data?.items?.[0]?.item;

      if (existing) {
        await axios.put(`${base}/persons/${existing.id}`, {
          name: `${lead.firstName} ${lead.lastName}`,
          ...(lead.email   && { email: [{ value: lead.email, primary: true }] }),
          ...(lead.company && { org_name: lead.company }),
          ...(lead.title   && { job_title: lead.title }),
        }, { params, timeout: 10_000 });
        console.log(`[Pipedrive] Updated person ${lead.email}`);
        return;
      }
    }

    await axios.post(`${base}/persons`, {
      name: `${lead.firstName} ${lead.lastName}`,
      ...(lead.email   && { email: [{ value: lead.email, primary: true }] }),
      ...(lead.company && { org_name: lead.company }),
      ...(lead.title   && { job_title: lead.title }),
    }, { params, timeout: 10_000 });

    console.log(`[Pipedrive] Created person ${lead.email ?? lead.firstName}`);
  } catch (err) {
    const msg = err instanceof AxiosError ? err.response?.data?.error ?? err.message : String(err);
    console.error('[Pipedrive] Sync error:', msg);
  }
}

export async function testPipedriveConnection(orgId?: string | null): Promise<boolean> {
  const creds = await resolveCreds(orgId);
  if (!creds) return false;
  try {
    await axios.get(
      `https://${creds.domain}.pipedrive.com/api/v1/users/me`,
      { params: { api_token: creds.apiKey }, timeout: 8_000 }
    );
    return true;
  } catch {
    return false;
  }
}
