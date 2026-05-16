/**
 * Substitutes merge variables like {{firstName}}, {company}, [[title]] etc.
 * Supports both {{var}}, {var}, and [[var]] syntax for compatibility.
 */
export interface LeadVars {
  firstName:   string;
  lastName:    string;
  email?:      string | null;
  company?:    string | null;
  title?:      string | null;
  industry?:   string | null;
  city?:       string | null;
  country?:    string | null;
  website?:    string | null;
  companySize?: string | null;
}

export function substituteVariables(template: string, lead: LeadVars): string {
  const fullName = `${lead.firstName} ${lead.lastName}`.trim();

  const vars: Record<string, string> = {
    firstName:   lead.firstName,
    first_name:  lead.firstName,
    lastName:    lead.lastName,
    last_name:   lead.lastName,
    fullName,
    full_name:   fullName,
    name:        fullName,
    email:       lead.email       ?? '',
    company:     lead.company     ?? '',
    title:       lead.title       ?? '',
    jobTitle:    lead.title       ?? '',
    job_title:   lead.title       ?? '',
    industry:    lead.industry    ?? '',
    city:        lead.city        ?? '',
    country:     lead.country     ?? '',
    website:     lead.website     ?? '',
    companySize: lead.companySize ?? '',
    company_size: lead.companySize ?? '',
  };

  // Replace {{var}}, {var}, and [[var]] — case-insensitive key matching
  return template.replace(/\{\{(\w+)\}\}|\{(\w+)\}|\[\[(\w+)\]\]/g, (match, a, b, c) => {
    const key = (a ?? b ?? c) as string;
    // Try exact key, then lowercase key, then camelCase lookup
    const val = vars[key] ?? vars[key.toLowerCase()] ?? vars[toCamel(key)];
    return val !== undefined ? val : match; // leave unchanged if unknown var
  });
}

function toCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}
