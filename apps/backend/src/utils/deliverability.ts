import dns from 'dns/promises';

export interface DeliverabilityResult {
  domain:  string;
  spf:     { valid: boolean; record: string | null };
  dkim:    { valid: boolean; selector: string | null };
  dmarc:   { valid: boolean; record: string | null; policy: string | null };
  score:   number;  // 0-100
  issues:  string[];
  tips:    string[];
}

const COMMON_DKIM_SELECTORS = [
  'google', 'selector1', 'selector2', 'mail', 'dkim',
  'k1', 'k2', 's1', 's2', 'email', 'smtp', 'default',
];

export async function checkDeliverability(domain: string): Promise<DeliverabilityResult> {
  const issues: string[] = [];
  const tips:   string[] = [];

  // SPF
  let spfRecord: string | null = null;
  let spfValid = false;
  try {
    const txtRecords = await dns.resolveTxt(domain);
    const spf = txtRecords.flat().find(r => r.startsWith('v=spf1'));
    if (spf) {
      spfRecord = spf;
      spfValid  = true;
    } else {
      issues.push('No SPF record found');
      tips.push('Add a TXT record: v=spf1 include:_spf.google.com ~all');
    }
  } catch {
    issues.push('Could not resolve DNS for SPF');
  }

  // DMARC
  let dmarcRecord: string | null = null;
  let dmarcValid  = false;
  let dmarcPolicy: string | null = null;
  try {
    const txtRecords = await dns.resolveTxt(`_dmarc.${domain}`);
    const dmarc = txtRecords.flat().find(r => r.startsWith('v=DMARC1'));
    if (dmarc) {
      dmarcRecord = dmarc;
      dmarcValid  = true;
      const pMatch = dmarc.match(/p=(\w+)/);
      dmarcPolicy = pMatch?.[1] ?? null;
      if (dmarcPolicy === 'none') {
        tips.push('DMARC policy is "none" — upgrade to p=quarantine for better deliverability');
      }
    } else {
      issues.push('No DMARC record found');
      tips.push(`Add a TXT record on _dmarc.${domain}: v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}`);
    }
  } catch {
    issues.push('No DMARC record found');
    tips.push(`Add a TXT record on _dmarc.${domain}: v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}`);
  }

  // DKIM — try common selectors
  let dkimValid    = false;
  let dkimSelector: string | null = null;
  for (const selector of COMMON_DKIM_SELECTORS) {
    try {
      const records = await dns.resolveTxt(`${selector}._domainkey.${domain}`);
      const dkim = records.flat().find(r => r.includes('v=DKIM1') || r.includes('k=rsa'));
      if (dkim) {
        dkimValid    = true;
        dkimSelector = selector;
        break;
      }
    } catch {
      // selector not found, try next
    }
  }

  if (!dkimValid) {
    issues.push('No DKIM record found (checked common selectors)');
    tips.push('Set up DKIM in your email provider (Google Workspace, Zoho, etc.) and add the TXT record');
  }

  // Score
  let score = 100;
  if (!spfValid)  score -= 30;
  if (!dkimValid) score -= 30;
  if (!dmarcValid) score -= 25;
  if (dmarcPolicy === 'none') score -= 5;

  return {
    domain,
    spf:   { valid: spfValid,   record: spfRecord },
    dkim:  { valid: dkimValid,  selector: dkimSelector },
    dmarc: { valid: dmarcValid, record: dmarcRecord, policy: dmarcPolicy },
    score: Math.max(0, score),
    issues,
    tips,
  };
}
