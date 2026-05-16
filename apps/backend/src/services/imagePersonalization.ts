import { createCanvas } from '@napi-rs/canvas';
import crypto from 'crypto';

// In-memory cache: hash → PNG buffer (max 1000 entries, 2hr TTL)
const cache = new Map<string, { buf: Buffer; ts: number }>();
const CACHE_TTL = 2 * 60 * 60 * 1000;
const MAX_CACHE = 1000;

export type TemplateId = '1' | '2' | '3';

export interface ImageParams {
  firstName: string;
  company:   string;
  title?:    string;
  template?: TemplateId;
}

interface Template {
  w: number; h: number;
  bg: [number, number, number];
  accent: string;
  style: 'dark' | 'light' | 'bold';
}

const TEMPLATES: Record<TemplateId, Template> = {
  '1': { w: 600, h: 260, bg: [8, 11, 16],   accent: '#6366f1', style: 'dark' },
  '2': { w: 600, h: 260, bg: [255,255,255],  accent: '#4f46e5', style: 'light' },
  '3': { w: 600, h: 220, bg: [17, 24, 39],   accent: '#8b5cf6', style: 'bold' },
};

function cacheKey(p: ImageParams): string {
  return crypto.createHash('sha1')
    .update(`${p.firstName}|${p.company}|${p.title ?? ''}|${p.template ?? '1'}`)
    .digest('hex');
}

function hex(color: string): [number, number, number] {
  const c = color.replace('#', '');
  return [
    parseInt(c.slice(0, 2), 16),
    parseInt(c.slice(2, 4), 16),
    parseInt(c.slice(4, 6), 16),
  ];
}

function rgba(color: string, alpha: number): string {
  const [r, g, b] = hex(color);
  return `rgba(${r},${g},${b},${alpha})`;
}

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text;
}

export async function generatePersonalizedImageLocal(params: ImageParams): Promise<Buffer> {
  const key = cacheKey(params);
  const now = Date.now();

  const cached = cache.get(key);
  if (cached && now - cached.ts < CACHE_TTL) return cached.buf;

  const tplId: TemplateId = (params.template ?? '1') as TemplateId;
  const tpl = TEMPLATES[tplId] ?? TEMPLATES['1'];

  const canvas = createCanvas(tpl.w, tpl.h);
  const ctx    = canvas.getContext('2d');

  const [br, bg, bb] = tpl.bg;
  const isLight = tpl.style === 'light';

  // ── Background ──────────────────────────────────────────────────────────────
  ctx.fillStyle = `rgb(${br},${bg},${bb})`;
  ctx.fillRect(0, 0, tpl.w, tpl.h);

  // Soft diagonal gradient
  const grad = ctx.createLinearGradient(0, 0, tpl.w, tpl.h);
  grad.addColorStop(0, rgba(tpl.accent, 0.08));
  grad.addColorStop(1, rgba(tpl.accent, 0.02));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, tpl.w, tpl.h);

  // ── Left accent bar ──────────────────────────────────────────────────────────
  const barGrad = ctx.createLinearGradient(0, 0, 0, tpl.h);
  barGrad.addColorStop(0, tpl.accent);
  barGrad.addColorStop(1, rgba(tpl.accent, 0.3));
  ctx.fillStyle = barGrad;
  ctx.fillRect(0, 0, 5, tpl.h);

  // ── Decorative circles (top-right) ───────────────────────────────────────────
  for (const [cx, cy, r, alpha] of [
    [tpl.w + 20, -20,  90, 0.06] as const,
    [tpl.w - 40,  40,  55, 0.09] as const,
    [tpl.w - 10, tpl.h + 10, 70, 0.05] as const,
  ]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = rgba(tpl.accent, alpha);
    ctx.fill();
  }

  // ── Greeting ─────────────────────────────────────────────────────────────────
  const textColor   = isLight ? '#1f2937' : '#ffffff';
  const mutedColor  = isLight ? '#6b7280' : '#9ca3af';
  const companyColor = tpl.accent;

  ctx.fillStyle = mutedColor;
  ctx.font = `16px "sans-serif"`;
  ctx.fillText('Hi,', 40, 60);

  // First name — large
  ctx.fillStyle = textColor;
  ctx.font = `bold 42px "sans-serif"`;
  ctx.fillText(truncate(params.firstName, 18), 40, 112);

  // Separator dot
  ctx.fillStyle = tpl.accent;
  ctx.beginPath();
  ctx.arc(40, 138, 3, 0, Math.PI * 2);
  ctx.fill();

  // Company
  ctx.fillStyle = companyColor;
  ctx.font = `bold 19px "sans-serif"`;
  ctx.fillText(truncate(params.company, 32), 52, 142);

  // Title
  if (params.title) {
    ctx.fillStyle = mutedColor;
    ctx.font = `15px "sans-serif"`;
    ctx.fillText(truncate(params.title, 40), 52, 168);
  }

  // ── Bottom line ───────────────────────────────────────────────────────────────
  ctx.strokeStyle = rgba(tpl.accent, 0.15);
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(40, tpl.h - 36);
  ctx.lineTo(tpl.w - 40, tpl.h - 36);
  ctx.stroke();

  ctx.fillStyle = mutedColor;
  ctx.font = `12px "sans-serif"`;
  ctx.fillText('Personalized just for you', 40, tpl.h - 16);

  const buf = canvas.toBuffer('image/png');

  // Evict oldest entry if full
  if (cache.size >= MAX_CACHE) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    if (oldest) cache.delete(oldest[0]);
  }
  cache.set(key, { buf, ts: now });

  return buf;
}

export function getPersonalizationUrl(
  backendUrl: string,
  params: ImageParams,
): string {
  const p = new URLSearchParams({
    n:  params.firstName,
    c:  params.company,
    ...(params.title    && { t: params.title }),
    ...(params.template && { tp: params.template }),
  });
  return `${backendUrl}/api/personalization/image?${p.toString()}`;
}
