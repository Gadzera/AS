import { scoreLeadFromProfile } from './claude';

interface LeadForScoring {
  title?: string | null;
  company?: string | null;
  companySize?: string | null;
  industry?: string | null;
  country?: string | null;
  email?: string | null;
  linkedinUrl?: string | null;
}

// ICP configuration
const ICP_TITLES = [
  'vp sales', 'vice president sales', 'head of sales', 'sales director',
  'chief revenue officer', 'cro', 'ceo', 'co-founder', 'founder',
  'sales manager', 'director of sales', 'vp of sales', 'chief executive',
  'head of growth', 'vp growth', 'director of business development',
];

const ICP_INDUSTRIES = [
  'saas', 'software', 'technology', 'consulting', 'marketing', 'advertising',
  'recruiting', 'staffing', 'real estate', 'insurance', 'fintech',
  'information technology',
];

const ICP_COMPANY_SIZES_GOOD = ['10-49', '50-199', '200-499'];
const ICP_COMPANY_SIZES_OK = ['1-9', '500-999'];

/**
 * Score a lead locally without AI (fast, rule-based)
 * Returns 0-100 score
 */
export function scoreLeadLocal(lead: LeadForScoring): number {
  let score = 0;

  // Must have email (40 points)
  if (lead.email) {
    score += 40;
  } else {
    return score; // Can't reach them without email or LinkedIn
  }

  // LinkedIn bonus (10 points)
  if (lead.linkedinUrl) {
    score += 10;
  }

  // Title match (25 points)
  if (lead.title) {
    const titleLower = lead.title.toLowerCase();
    if (ICP_TITLES.some((t) => titleLower.includes(t))) {
      score += 25;
    } else if (
      titleLower.includes('director') ||
      titleLower.includes('manager') ||
      titleLower.includes('lead')
    ) {
      score += 10;
    }
  }

  // Industry match (15 points)
  if (lead.industry) {
    const industryLower = lead.industry.toLowerCase();
    if (ICP_INDUSTRIES.some((i) => industryLower.includes(i))) {
      score += 15;
    }
  }

  // Company size match (10 points)
  if (lead.companySize) {
    if (ICP_COMPANY_SIZES_GOOD.includes(lead.companySize)) {
      score += 10;
    } else if (ICP_COMPANY_SIZES_OK.includes(lead.companySize)) {
      score += 5;
    }
  }

  return Math.min(100, score);
}

/**
 * Score a lead using AI (Claude) — more accurate but slower
 */
export async function scoreLeadAI(lead: LeadForScoring): Promise<number> {
  return scoreLeadFromProfile(lead);
}

/**
 * Batch score leads locally
 */
export function batchScoreLeads(leads: LeadForScoring[]): number[] {
  return leads.map((lead) => scoreLeadLocal(lead));
}

/**
 * Get score color class for display
 */
export function getScoreColor(score: number): 'green' | 'yellow' | 'red' | 'gray' {
  if (score >= 70) return 'green';
  if (score >= 40) return 'yellow';
  if (score > 0) return 'red';
  return 'gray';
}
