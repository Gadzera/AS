'use client';

/**
 * Settings → Security (M23-1, S380). Self-service: смена пароля, активные сессии (revoke), 2FA (TOTP)+recovery.
 * Смена пароля возвращает новый токен (текущая сессия живёт). 2FA: setup→verify→recovery; disable требует код.
 */
import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Loader2, Monitor, ShieldCheck, ShieldOff, Smartphone, Trash2, Check, Copy, AlertTriangle, Lock } from 'lucide-react';
import { authApi, securityApi, type DeviceSession, type TwoFactorStatus } from '@/lib/api';
import { setToken } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';

function ua(s: string | null): string {
  if (!s) return 'Unknown device';
  if (/iphone|android|mobile/i.test(s)) return 'Mobile device';
  if (/chrome/i.test(s)) return 'Chrome'; if (/firefox/i.test(s)) return 'Firefox'; if (/safari/i.test(s)) return 'Safari'; if (/edg/i.test(s)) return 'Edge';
  return s.slice(0, 40);
}
function ago(iso: string): string { const d = (Date.now() - new Date(iso).getTime()) / 1000; return d < 60 ? 'just now' : d < 3600 ? `${Math.floor(d / 60)}m ago` : d < 86400 ? `${Math.floor(d / 3600)}h ago` : `${Math.floor(d / 86400)}d ago`; }

export default function SecuritySettings() {
  const toast = useToast();
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [tfa, setTfa] = useState<TwoFactorStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([securityApi.sessions().catch(() => []), securityApi.twoFactor().catch(() => null)])
      .then(([s, t]) => { setSessions(s); setTfa(t); }).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  // ── change password ──
  const [pw, setPw] = useState({ cur: '', next: '', confirm: '' });
  const [pwBusy, setPwBusy] = useState(false);
  async function changePassword() {
    if (pw.next !== pw.confirm) { toast.error('Passwords don’t match'); return; }
    if (pw.next.length < 8) { toast.error('New password must be at least 8 characters'); return; }
    setPwBusy(true);
    try {
      const r = await authApi.changePassword(pw.cur, pw.next);
      if (r.token) setToken(r.token); // M23-1: новый токен — текущая сессия продолжает
      setPw({ cur: '', next: '', confirm: '' });
      toast.success('Password changed', 'Other sessions were signed out.');
      load();
    } catch (e) { toast.error('Could not change password', (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? ''); }
    finally { setPwBusy(false); }
  }

  // ── sessions ──
  const [revoking, setRevoking] = useState('');
  async function revoke(id: string) { setRevoking(id); try { await securityApi.revokeSession(id); load(); } finally { setRevoking(''); } }
  async function revokeOthers() { const r = await securityApi.revokeOthers().catch(() => null); if (r) toast.success('Signed out other devices', `${r.revoked} session(s)`); load(); }

  // ── 2FA ──
  const [setup, setSetup] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [code, setCode] = useState('');
  const [tfaBusy, setTfaBusy] = useState(false);
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [disableCode, setDisableCode] = useState('');

  async function startSetup() { setTfaBusy(true); try { setSetup(await securityApi.setup2fa()); setCode(''); } finally { setTfaBusy(false); } }
  async function verifySetup() {
    setTfaBusy(true);
    try { const r = await securityApi.verify2fa(code.trim()); setRecovery(r.recoveryCodes); setSetup(null); setCode(''); load(); toast.success('Two-factor enabled'); }
    catch (e) { toast.error('Code incorrect', (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? ''); }
    finally { setTfaBusy(false); }
  }
  async function disable() {
    setTfaBusy(true);
    try { await securityApi.disable2fa(disableCode.trim()); setDisableCode(''); setRecovery(null); load(); toast.success('Two-factor disabled'); }
    catch (e) { toast.error('Code incorrect', (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? ''); }
    finally { setTfaBusy(false); }
  }

  if (loading) return <div className="flex items-center gap-2 py-6 text-[12.5px] text-ink-subtle"><Loader2 size={14} className="animate-spin" /> Loading security…</div>;

  return (
    <div className="space-y-5">
      {/* ── Change password ── */}
      <div>
        <p className="mb-2 inline-flex items-center gap-1.5 text-[13px] font-bold text-ink"><KeyRound size={15} className="text-brand-600" /> Password</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <input type="password" placeholder="Current password" value={pw.cur} onChange={(e) => setPw({ ...pw, cur: e.target.value })} autoComplete="current-password" className="h-9 rounded-lg border border-line bg-surface px-3 text-[12.5px] text-ink focus:border-brand-500 focus:outline-none" />
          <input type="password" placeholder="New password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" className="h-9 rounded-lg border border-line bg-surface px-3 text-[12.5px] text-ink focus:border-brand-500 focus:outline-none" />
          <input type="password" placeholder="Confirm new password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} autoComplete="new-password" className="h-9 rounded-lg border border-line bg-surface px-3 text-[12.5px] text-ink focus:border-brand-500 focus:outline-none" />
        </div>
        <button type="button" disabled={pwBusy || !pw.cur || !pw.next} onClick={changePassword} className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-[12px] font-semibold text-white hover:bg-brand-700 disabled:opacity-50">{pwBusy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Update password</button>
        <p className="mt-1 text-[11px] text-ink-subtle">Changing your password signs out all other devices.</p>
      </div>

      {/* ── 2FA ── */}
      <div className="border-t border-line pt-4">
        <div className="flex items-center gap-2">
          <p className="inline-flex items-center gap-1.5 text-[13px] font-bold text-ink"><ShieldCheck size={15} className="text-brand-600" /> Two-factor authentication</p>
          <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${tfa?.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-surface-2 text-ink-muted'}`}>{tfa?.enabled ? 'On' : 'Off'}</span>
          {tfa?.enabled && <span className="text-[11px] text-ink-subtle">· {tfa.recoveryLeft} recovery codes left</span>}
        </div>

        {/* recovery codes (показываем один раз) */}
        {recovery && (
          <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
            <p className="flex items-center gap-1.5 text-[12px] font-bold text-amber-800"><AlertTriangle size={13} /> Save these recovery codes — shown once</p>
            <div className="mt-2 grid grid-cols-2 gap-1 font-mono text-[12px] text-ink sm:grid-cols-5">{recovery.map((c) => <span key={c} className="rounded bg-surface px-1.5 py-0.5 text-center">{c}</span>)}</div>
            <button type="button" onClick={() => { navigator.clipboard?.writeText(recovery.join('\n')); toast.success('Copied'); }} className="mt-2 inline-flex h-7 items-center gap-1 rounded-md border border-line bg-surface px-2 text-[11px] font-semibold text-ink-muted hover:bg-surface-2"><Copy size={11} /> Copy</button>
          </div>
        )}

        {!tfa?.enabled && !setup && (
          <button type="button" disabled={tfaBusy} onClick={startSetup} className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 text-[12px] font-semibold text-brand-700 hover:bg-brand-100">{tfaBusy ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />} Set up 2FA</button>
        )}

        {/* setup: secret + verify */}
        {setup && (
          <div className="mt-2 rounded-xl border border-line bg-surface-2/40 p-3">
            <p className="text-[12px] text-ink-muted">Add this secret to your authenticator app (Google Authenticator, 1Password, Authy), then enter the 6-digit code to confirm.</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="rounded-lg border border-line bg-surface px-2 py-1 font-mono text-[12.5px] font-bold tracking-wider text-ink">{setup.secret}</code>
              <button type="button" onClick={() => { navigator.clipboard?.writeText(setup.secret); toast.success('Secret copied'); }} className="inline-flex h-7 items-center gap-1 rounded-md border border-line bg-surface px-2 text-[11px] font-semibold text-ink-muted hover:bg-surface-2"><Copy size={11} /> Copy</button>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input type="text" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} className="h-8 w-28 rounded-lg border border-line bg-surface px-3 text-center text-[13px] font-mono tracking-widest text-ink focus:border-brand-500 focus:outline-none" />
              <button type="button" disabled={tfaBusy || !code.trim()} onClick={verifySetup} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-[12px] font-semibold text-white hover:bg-brand-700 disabled:opacity-50">{tfaBusy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Verify & enable</button>
              <button type="button" onClick={() => { setSetup(null); setCode(''); }} className="text-[12px] font-medium text-ink-muted hover:text-ink">Cancel</button>
            </div>
          </div>
        )}

        {/* enabled: disable */}
        {tfa?.enabled && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input type="text" placeholder="Code to disable" value={disableCode} onChange={(e) => setDisableCode(e.target.value)} className="h-8 w-40 rounded-lg border border-line bg-surface px-3 text-[12.5px] text-ink focus:border-brand-500 focus:outline-none" />
            <button type="button" disabled={tfaBusy || !disableCode.trim()} onClick={disable} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 text-[12px] font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"><ShieldOff size={13} /> Disable 2FA</button>
          </div>
        )}

        {/* SSO/SAML — honest enterprise-stub */}
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2/30 px-3 py-1.5 text-[11.5px] text-ink-subtle"><Lock size={12} /> SSO / SAML — available on Enterprise (not in demo)</div>
      </div>

      {/* ── Active sessions ── */}
      <div className="border-t border-line pt-4">
        <div className="flex items-center gap-2">
          <p className="inline-flex items-center gap-1.5 text-[13px] font-bold text-ink"><Monitor size={15} className="text-brand-600" /> Active sessions</p>
          {sessions.length > 1 && <button type="button" onClick={revokeOthers} className="ml-auto inline-flex h-7 items-center gap-1 rounded-lg border border-line bg-surface px-2.5 text-[11.5px] font-semibold text-ink-muted hover:bg-surface-2">Sign out other devices</button>}
        </div>
        <div className="mt-2 space-y-1.5">
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-ink-muted">{/mobile/i.test(s.userAgent ?? '') ? <Smartphone size={15} /> : <Monitor size={15} />}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-bold text-ink">{ua(s.userAgent)} {s.current && <span className="ml-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">This device</span>}</p>
                <p className="text-[11px] text-ink-subtle">Last active {ago(s.lastSeenAt)} · signed in {ago(s.createdAt)}</p>
              </div>
              {!s.current && <button type="button" disabled={revoking === s.id} onClick={() => revoke(s.id)} className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-subtle hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50">{revoking === s.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}</button>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
