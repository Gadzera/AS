'use client';

/**
 * DigestPanel (M22-2, S399/S400) — preview email-дайджеста непрочитанного (per-user, access-filtered).
 * Honest no-SMTP: без SMTP показываем «Demo mode — digest won't send», Send → SKIPPED_NO_SMTP (не fake success).
 * Capability-чипы (email/ai/billing) честно отражают demo-режим.
 */
import { useCallback, useEffect, useState } from 'react';
import { Mail, Loader2, ShieldAlert, Send, CheckCircle2, AlertTriangle, Sparkles, CreditCard } from 'lucide-react';
import { notificationsApi, onboardingApi, type DigestPreview, type OnboardingStatus, type DigestStatus } from '@/lib/api';

export default function DigestPanel() {
  const [digest, setDigest] = useState<DigestPreview | null>(null);
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sentResult, setSentResult] = useState<{ status: DigestStatus; count: number } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([notificationsApi.digest(24).catch(() => null), onboardingApi.status().catch(() => null)])
      .then(([d, s]) => { setDigest(d); setStatus(s); })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const [rateLimited, setRateLimited] = useState(false);
  async function send() {
    setSending(true); setSentResult(null); setRateLimited(false);
    try { const r = await notificationsApi.sendDigest(); setSentResult({ status: r.status, count: r.count }); load(); }
    catch (e) { if ((e as { response?: { status?: number } })?.response?.status === 429) setRateLimited(true); }
    finally { setSending(false); }
  }

  if (loading) return <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-[12px] text-ink-subtle"><Loader2 size={14} className="animate-spin" /> Loading digest…</div>;
  if (!digest) return null;
  const smtp = digest.smtpConfigured;
  const caps = status?.capabilities;

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="brand-gradient flex h-8 w-8 items-center justify-center rounded-lg text-white"><Mail size={15} /></span>
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-ink">Email digest</p>
          <p className="text-[11px] text-ink-subtle">{digest.count} unread in the last 24h{digest.redactedCount > 0 ? ` · ${digest.redactedCount} hidden (no access)` : ''}</p>
        </div>
        {/* honest SMTP-статус */}
        <span className={`ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${smtp ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
          {smtp ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />} {smtp ? 'Email configured' : 'Demo mode · no SMTP'}
        </span>
        <button type="button" disabled={sending || digest.count === 0} onClick={send} title={!smtp ? 'No SMTP — will honestly skip (no fake send)' : undefined}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-[12px] font-semibold text-white shadow-brand hover:bg-brand-700 disabled:opacity-50">
          {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Send digest now
        </button>
      </div>

      {/* rate-limited (повторный send в течение часа) */}
      {rateLimited && (
        <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-1.5 text-[11.5px] font-semibold text-ink-muted"><ShieldAlert size={12} /> A digest was sent recently — try again later.</div>
      )}
      {/* результат отправки (honest) */}
      {sentResult && (
        <div className={`mt-2 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11.5px] font-semibold ${sentResult.status === 'SENT' ? 'bg-emerald-50 text-emerald-700' : sentResult.status === 'SKIPPED_NO_SMTP' ? 'bg-amber-50 text-amber-700' : 'bg-surface-2 text-ink-muted'}`}>
          {sentResult.status === 'SENT' ? <><CheckCircle2 size={12} /> Sent {sentResult.count} item(s) by email.</> : sentResult.status === 'SKIPPED_NO_SMTP' ? <><ShieldAlert size={12} /> Skipped — no SMTP configured (demo). Nothing was actually sent.</> : <>Nothing to send.</>}
        </div>
      )}

      {/* preview items (access-filtered; redacted → generic) */}
      {digest.items.length > 0 && (
        <ul className="mt-2.5 space-y-1">
          {digest.items.slice(0, 6).map((i) => (
            <li key={i.id + i.createdAt} className="flex items-start gap-2 text-[12px]">
              <span className={`mt-0.5 rounded px-1.5 py-0.5 text-[9.5px] font-bold ${i.type === 'MENTION' ? 'bg-brand-50 text-brand-700' : i.type === 'REPLY' ? 'bg-violet-50 text-violet-700' : 'bg-surface-2 text-ink-muted'}`}>{i.type.toLowerCase()}</span>
              <span className={`min-w-0 flex-1 ${i.redacted ? 'italic text-ink-subtle' : 'text-ink'}`}>{i.title}{i.redacted && ' (access lost — record name hidden)'}</span>
            </li>
          ))}
        </ul>
      )}

      {/* demo capability-чипы (honest) */}
      {caps && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-2.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-ink-subtle">Demo capabilities</span>
          <Cap on={caps.ai} icon={<Sparkles size={11} />} label="AI" />
          <Cap on={caps.email} icon={<Mail size={11} />} label="Email/SMTP" />
          <Cap on={caps.billing} icon={<CreditCard size={11} />} label="Billing" />
          <span className="text-[10.5px] text-ink-subtle">· everything works in demo; unconfigured channels honestly skip</span>
        </div>
      )}
    </div>
  );
}

function Cap({ on, icon, label }: { on: boolean; icon: React.ReactNode; label: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${on ? 'bg-emerald-50 text-emerald-700' : 'bg-surface-2 text-ink-subtle'}`}>{icon} {label}: {on ? 'on' : 'demo'}</span>;
}
