'use client';

/**
 * Workspace General (M23-2, S373/S375/S379) — логотип (URL) + домен компании (admin-only), текущий план
 * (из БД — единый источник, апгрейд в Billing), Storage accounts (honest-stub, без fake-connect).
 */
import { useCallback, useEffect, useState } from 'react';
import { Building2, Loader2, Check, Globe, Image as ImageIcon, Gauge, HardDrive, Lock, CreditCard } from 'lucide-react';
import { settingsApi, type Workspace } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

export default function WorkspaceGeneral({ onSection }: { onSection?: (s: string) => void }) {
  const toast = useToast();
  const [ws, setWs] = useState<Workspace | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [logo, setLogo] = useState('');
  const [domain, setDomain] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    settingsApi.getWorkspace().then((r) => { setWs(r.workspace); setCanManage(r.canManage); setLogo(r.workspace.logoUrl ?? ''); setDomain(r.workspace.companyDomain ?? ''); }).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function save() {
    setBusy(true);
    try { const r = await settingsApi.updateWorkspace({ logoUrl: logo.trim() || null, companyDomain: domain.trim() || null }); setWs(r.workspace); toast.success('Workspace saved'); }
    catch (e) { toast.error('Could not save', (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? ''); }
    finally { setBusy(false); }
  }

  if (loading) return <div className="flex items-center gap-2 py-4 text-[12.5px] text-ink-subtle"><Loader2 size={14} className="animate-spin" /> Loading…</div>;
  if (!ws) return null;
  const dirty = (logo.trim() || null) !== (ws.logoUrl ?? null) || (domain.trim() || null) !== (ws.companyDomain ?? null);

  return (
    <div className="space-y-5">
      {/* Logo + domain */}
      <div>
        <p className="mb-2 inline-flex items-center gap-1.5 text-[13px] font-bold text-ink"><Building2 size={15} className="text-brand-600" /> General</p>
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-surface-2 text-ink-subtle">
            {logo.trim() ? <img src={logo.trim()} alt="logo" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : <ImageIcon size={18} />}
          </span>
          <div className="grid flex-1 gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-ink-muted"><ImageIcon size={11} /> Logo URL</span>
              <input value={logo} onChange={(e) => setLogo(e.target.value)} disabled={!canManage} placeholder="https://…/logo.png" className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-[12.5px] text-ink focus:border-brand-500 focus:outline-none disabled:opacity-60" />
            </label>
            <label className="block">
              <span className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-ink-muted"><Globe size={11} /> Company domain</span>
              <input value={domain} onChange={(e) => setDomain(e.target.value)} disabled={!canManage} placeholder="acme.com" className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-[12.5px] text-ink focus:border-brand-500 focus:outline-none disabled:opacity-60" />
            </label>
          </div>
        </div>
        {canManage ? (
          <button type="button" disabled={busy || !dirty} onClick={save} className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-[12px] font-semibold text-white hover:bg-brand-700 disabled:opacity-50">{busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Save</button>
        ) : <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-ink-subtle"><Lock size={11} /> Only an admin can edit workspace details.</p>}
      </div>

      {/* Plan (из БД — единый источник; апгрейд в Billing) */}
      <div className="border-t border-line pt-4">
        <p className="mb-2 inline-flex items-center gap-1.5 text-[13px] font-bold text-ink"><Gauge size={15} className="text-brand-600" /> Plan</p>
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-2/40 px-4 py-3">
          <span className="rounded-lg bg-brand-50 px-2.5 py-1 text-[12px] font-bold text-brand-700">{ws.plan}</span>
          <span className="text-[12px] text-ink-muted">{ws.leadsLimit.toLocaleString()} leads · daily send {ws.dailySendLimit}</span>
          <button type="button" onClick={() => onSection?.('billing')} className="ml-auto inline-flex h-7 items-center gap-1 rounded-lg border border-line bg-surface px-2.5 text-[11.5px] font-semibold text-brand-700 hover:bg-brand-50"><CreditCard size={12} /> Manage in Billing</button>
        </div>
      </div>

      {/* Storage accounts — honest stub (S379) */}
      <div className="border-t border-line pt-4">
        <p className="mb-2 inline-flex items-center gap-1.5 text-[13px] font-bold text-ink"><HardDrive size={15} className="text-brand-600" /> Storage accounts</p>
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface-2/30 px-4 py-3">
          <span className="text-[12px] text-ink-muted">No external file storage connected.</span>
          <button type="button" disabled title="Storage integration (S3 / Google Drive) ships with Enterprise" className="ml-auto inline-flex h-7 cursor-not-allowed items-center gap-1 rounded-lg border border-line bg-surface px-2.5 text-[11.5px] font-semibold text-ink-subtle opacity-70"><Lock size={11} /> Connect — Enterprise</button>
        </div>
        <p className="mt-1 text-[11px] text-ink-subtle">Files use built-in storage in demo. External providers (S3, Google Drive) arrive with the storage integration — no fake connection here.</p>
      </div>
    </div>
  );
}
