export interface SpamCheckResult {
  score: number;        // 0–100, lower is better
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  issues: string[];
  passed: string[];
}

// Weighted spam trigger words/patterns
const SPAM_WORDS: [RegExp, number, string][] = [
  [/\bfree\b/gi,               3, 'Word "free"'],
  [/\bguarantee[d]?\b/gi,      3, 'Word "guaranteed"'],
  [/\bact now\b/gi,            4, '"Act now" urgency phrase'],
  [/\blimited.?time\b/gi,      3, '"Limited time" urgency'],
  [/\b100%\b/gi,               2, '"100%" claim'],
  [/\bcash\b/gi,               2, 'Word "cash"'],
  [/\bwin\b/gi,                1, 'Word "win"'],
  [/\bprize\b/gi,              4, 'Word "prize"'],
  [/\bunsubscribe\b/gi,        0, ''],  // neutral — good practice
  [/\bclick here\b/gi,         3, '"Click here"'],
  [/\bbuy now\b/gi,            3, '"Buy now"'],
  [/\bspecial offer\b/gi,      3, '"Special offer"'],
  [/\bdiscount\b/gi,           2, 'Word "discount"'],
  [/\bno cost\b/gi,            3, '"No cost"'],
  [/\bexclusive deal\b/gi,     3, '"Exclusive deal"'],
  [/\bsave \$\d/gi,            2, '"Save $X" phrase'],
  [/\bmake money\b/gi,         5, '"Make money"'],
  [/\bwork from home\b/gi,     4, '"Work from home"'],
  [/\bpassive income\b/gi,     4, '"Passive income"'],
  [/\bcongratulations\b/gi,    3, 'Word "congratulations"'],
  [/\byou.?ve been selected\b/gi, 5, '"You\'ve been selected"'],
  [/\bno obligation\b/gi,      3, '"No obligation"'],
  [/\bwhy pay more\b/gi,       3, '"Why pay more"'],
];

export function checkSpamScore(subject: string, body: string): SpamCheckResult {
  const issues: string[] = [];
  const passed: string[] = [];
  let score = 0;

  const fullText = `${subject}\n${body}`;

  // ── Spam word check ───────────────────────────────────────────────────────
  for (const [pattern, penalty, label] of SPAM_WORDS) {
    if (label && pattern.test(fullText)) {
      score += penalty;
      issues.push(`Spam trigger word: ${label} (+${penalty}pts)`);
    }
    pattern.lastIndex = 0;
  }

  // ── CAPS ratio ────────────────────────────────────────────────────────────
  const letters = fullText.replace(/[^a-zA-Z]/g, '');
  const capsRatio = letters.length > 0 ? letters.replace(/[^A-Z]/g, '').length / letters.length : 0;
  if (capsRatio > 0.3) {
    const pen = Math.round(capsRatio * 20);
    score += pen;
    issues.push(`Too many CAPS (${Math.round(capsRatio * 100)}%) (+${pen}pts)`);
  } else {
    passed.push('Normal capitalization');
  }

  // ── Subject line length ────────────────────────────────────────────────────
  if (subject.length < 5) {
    score += 5;
    issues.push('Subject too short (+5pts)');
  } else if (subject.length > 80) {
    score += 3;
    issues.push('Subject too long — gets cut off (+3pts)');
  } else {
    passed.push('Good subject length');
  }

  // ── Exclamation marks ─────────────────────────────────────────────────────
  const exclamations = (fullText.match(/!/g) ?? []).length;
  if (exclamations > 3) {
    score += exclamations;
    issues.push(`Too many exclamation marks (${exclamations}) (+${exclamations}pts)`);
  } else {
    passed.push('Reasonable use of exclamation marks');
  }

  // ── URL count ─────────────────────────────────────────────────────────────
  const urlCount = (body.match(/https?:\/\//gi) ?? []).length;
  if (urlCount > 5) {
    score += urlCount * 2;
    issues.push(`Many links in email (${urlCount}) (+${urlCount * 2}pts)`);
  } else {
    passed.push('Reasonable number of links');
  }

  // ── Text length ────────────────────────────────────────────────────────────
  const wordCount = body.trim().split(/\s+/).length;
  if (wordCount < 30) {
    score += 5;
    issues.push('Email body too short — looks spammy (+5pts)');
  } else if (wordCount > 600) {
    score += 3;
    issues.push('Email too long (+3pts)');
  } else {
    passed.push('Good email length');
  }

  // ── No personalization ────────────────────────────────────────────────────
  const hasPersonalization = /\{first.?name\}|\{name\}|\{company\}|\bhi\s+\w/i.test(fullText);
  if (!hasPersonalization) {
    score += 3;
    issues.push('No personalization detected (+3pts)');
  } else {
    passed.push('Personalization present');
  }

  // ── Dollar signs ──────────────────────────────────────────────────────────
  const dollarCount = (fullText.match(/\$/g) ?? []).length;
  if (dollarCount > 2) {
    score += dollarCount * 2;
    issues.push(`Multiple $ signs (${dollarCount}) (+${dollarCount * 2}pts)`);
  }

  // ── Score clamp + grade ───────────────────────────────────────────────────
  score = Math.min(100, Math.max(0, score));
  const grade: SpamCheckResult['grade'] =
    score <= 10 ? 'A' :
    score <= 25 ? 'B' :
    score <= 45 ? 'C' :
    score <= 65 ? 'D' : 'F';

  return { score, grade, issues, passed };
}
