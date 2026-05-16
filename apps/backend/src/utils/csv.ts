export interface CSVRow {
  firstName?: string;
  lastName?: string;
  email?: string;
  linkedinUrl?: string;
  title?: string;
  company?: string;
  industry?: string;
  country?: string;
  city?: string;
  website?: string;
}

const COLUMN_ALIASES: Record<string, keyof CSVRow> = {
  firstname: 'firstName', first_name: 'firstName', 'first name': 'firstName',
  lastname: 'lastName', last_name: 'lastName', 'last name': 'lastName',
  email: 'email', 'email address': 'email',
  linkedin: 'linkedinUrl', linkedinurl: 'linkedinUrl', linkedin_url: 'linkedinUrl', 'linkedin url': 'linkedinUrl',
  title: 'title', jobtitle: 'title', job_title: 'title', 'job title': 'title', position: 'title',
  company: 'company', 'company name': 'company', organization: 'company',
  industry: 'industry',
  country: 'country',
  city: 'city', location: 'city',
  website: 'website', 'company website': 'website', url: 'website',
};

function parseLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  values.push(current.trim());
  return values;
}

function sanitizeCell(value: string): string {
  // Prevent CSV formula injection when opened in spreadsheet apps
  return /^[=+\-@\t]/.test(value) ? `'${value}` : value;
}

export function parseCSV(content: string): CSVRow[] {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
  if (lines.length < 2) return [];

  const rawHeaders = parseLine(lines[0]);
  const headers = rawHeaders.map((h) => {
    const clean = h.toLowerCase().replace(/['"]/g, '').trim();
    return COLUMN_ALIASES[clean] ?? null;
  });

  return lines
    .slice(1)
    .filter((l) => l.trim())
    .map((line) => {
      const values = parseLine(line);
      const row: CSVRow = {};
      headers.forEach((key, i) => {
        if (key && values[i]) (row as Record<string, string>)[key] = sanitizeCell(values[i]);
      });
      return row;
    })
    .filter((row) => row.firstName || row.email);
}

export function exportRowToCsv(values: (string | null | undefined)[]): string {
  return values
    .map(v => {
      const s = String(v ?? '');
      const safe = sanitizeCell(s);
      return `"${safe.replace(/"/g, '""')}"`;
    })
    .join(',');
}
