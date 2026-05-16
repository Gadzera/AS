import axios from 'axios';
import { config } from '../config';

interface LeadForImage {
  firstName: string;
  lastName: string;
  company?: string | null;
  title?: string | null;
}

interface BannerbearModification {
  name: string;
  text?: string;
  image_url?: string;
}

export async function generatePersonalizedImage(
  lead: LeadForImage,
  templateId: string,
  extraMods: BannerbearModification[] = []
): Promise<string | null> {
  if (!config.bannerbear.apiKey || !templateId) return null;

  const modifications: BannerbearModification[] = [
    { name: 'name',    text: `${lead.firstName} ${lead.lastName}` },
    { name: 'company', text: lead.company ?? '' },
    { name: 'title',   text: lead.title   ?? '' },
    ...extraMods,
  ];

  try {
    const res = await axios.post(
      'https://api.bannerbear.com/v2/images',
      { template: templateId, modifications, synchronous: true },
      {
        headers: {
          Authorization: `Bearer ${config.bannerbear.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 20_000,
      }
    );
    return (res.data?.image_url_png as string) ?? null;
  } catch (err) {
    console.error('[Bannerbear] Image generation failed:', (err as Error).message);
    return null;
  }
}

export async function listBannerbearTemplates(): Promise<{ uid: string; name: string; preview_url: string }[]> {
  if (!config.bannerbear.apiKey) return [];

  try {
    const res = await axios.get('https://api.bannerbear.com/v2/templates', {
      headers: { Authorization: `Bearer ${config.bannerbear.apiKey}` },
      timeout: 10_000,
    });
    return (res.data as { uid: string; name: string; preview_url: string }[]) ?? [];
  } catch (err) {
    console.error('[Bannerbear] List templates failed:', (err as Error).message);
    return [];
  }
}
