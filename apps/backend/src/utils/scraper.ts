import axios from 'axios';

/**
 * Fetches a website and extracts readable text content.
 * Returns null on any failure — never throws.
 */
export async function scrapeWebsite(url: string): Promise<string | null> {
  try {
    const response = await axios.get<string>(url, {
      timeout: 8_000,
      maxContentLength: 500_000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AISdrAgent/1.0)',
        Accept: 'text/html',
      },
      validateStatus: (status) => status < 400,
    });

    const html = response.data;
    if (typeof html !== 'string') return null;

    const text = html
      .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]{0,500}>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8_000);

    return text || null;
  } catch {
    return null;
  }
}
