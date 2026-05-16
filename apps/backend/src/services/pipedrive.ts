import axios, { AxiosError } from 'axios';
import { config } from '../config';

interface LeadPayload {
  email?: string | null;
  firstName: string;
  lastName: string;
  company?: string | null;
  title?: string | null;
}

export async function upsertPipedriveContact(lead: LeadPayload): Promise<void> {
  if (!config.pipedrive.apiKey || !config.pipedrive.domain) return;

  const base = `https://${config.pipedrive.domain}.pipedrive.com/api/v1`;
  const params = { api_token: config.pipedrive.apiKey };

  try {
    // Search for existing person by email
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

    // Create new person
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

export async function testPipedriveConnection(): Promise<boolean> {
  if (!config.pipedrive.apiKey || !config.pipedrive.domain) return false;
  try {
    await axios.get(
      `https://${config.pipedrive.domain}.pipedrive.com/api/v1/users/me`,
      { params: { api_token: config.pipedrive.apiKey }, timeout: 8_000 }
    );
    return true;
  } catch {
    return false;
  }
}
