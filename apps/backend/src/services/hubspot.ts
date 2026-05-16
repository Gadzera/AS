import axios, { AxiosError } from 'axios';
import { config } from '../config';

const BASE = 'https://api.hubapi.com';

interface LeadPayload {
  email?: string | null;
  firstName: string;
  lastName: string;
  company?: string | null;
  title?: string | null;
  status: string;
}

function buildProperties(lead: LeadPayload) {
  return {
    ...(lead.email    && { email:    lead.email }),
    firstname:  lead.firstName,
    lastname:   lead.lastName,
    ...(lead.company  && { company:  lead.company }),
    ...(lead.title    && { jobtitle: lead.title }),
    hs_lead_status: lead.status === 'HOT' ? 'IN_PROGRESS' : 'OPEN',
  };
}

export async function upsertHubSpotContact(lead: LeadPayload): Promise<void> {
  if (!config.hubspot.accessToken) return;

  const headers = { Authorization: `Bearer ${config.hubspot.accessToken}` };
  const properties = buildProperties(lead);

  try {
    if (lead.email) {
      // Try create-or-update by email
      await axios.post(
        `${BASE}/crm/v3/objects/contacts/upsert`,
        { inputs: [{ idProperty: 'email', id: lead.email, properties }] },
        { headers, timeout: 10_000 }
      );
    } else {
      await axios.post(`${BASE}/crm/v3/objects/contacts`, { properties }, { headers, timeout: 10_000 });
    }
    console.log(`[HubSpot] Synced ${lead.email ?? lead.firstName}`);
  } catch (err) {
    const msg = err instanceof AxiosError ? err.response?.data?.message ?? err.message : String(err);
    console.error('[HubSpot] Sync error:', msg);
  }
}

export async function testHubSpotConnection(): Promise<boolean> {
  if (!config.hubspot.accessToken) return false;
  try {
    await axios.get(`${BASE}/crm/v3/objects/contacts?limit=1`, {
      headers: { Authorization: `Bearer ${config.hubspot.accessToken}` },
      timeout: 8_000,
    });
    return true;
  } catch {
    return false;
  }
}
