'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { listRecords, getObject, runAiForRecord, type CrmRecord, type CrmRecordValue, type CrmAttribute } from '@/lib/crmApi';
import {
  FlaskConical,
  Bot,
  Sparkles,
  FileSearch,
  Loader2,
  ShieldCheck,
  Flame,
  ChevronDown,
  Gauge,
} from 'lucide-react';
import Topbar from '@/components/layout/Topbar';

/* ──────────────────────────────────────────────────────────────────────────
   Research Lab (/research) — движок AI-research аккаунтов. Живой: компании +
   их AI Research-поле (provenance/evidence/confidence). «Run research» реально
   вызывает агента (DeepSeek) и заполняет поле — наблюдаемо (запись уходит из
   очереди в досье). Светлая Bold-тема.
   ────────────────────────────────────────────────────────────────────────── */

const TONES = ['from-[#6366f1] to-[#8b5cf6]', 'from-[#06b6d4] to-[#4f46e5]', 'from-[#8b5cf6] to-[#d946ef]', 'from-[#10b981] to-[#06b6d4]', 'from-[#f59e0b] to-[#f43f5e]'];
function initials(n: string) { return (n || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase(); }
function txt(v: CrmRecordValue | undefined): string {
  if (v == null) return '';
  if (Array.isArray(v)) return v.map((x) => txt(x as CrmRecordValue)).filter(Boolean).join(', ');
  if (typeof v === 'object') { const o = v as Record<string, unknown>; return String(o.displayName ?? o.name ?? o.label ?? o.value ?? ''); }
  return String(v);
}
function num(v: CrmRecordValue | undefined): number { const n = Number(txt(v)); return isNaN(n) ? 0 : n; }

export default function ResearchLabPage() {
  const router = useRouter();
  const [records, setRecords] = useState<CrmRecord[]>([]);
  const [researchAttrId, setResearchAttrId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState('');

  function showToast(m: string) { setToast(m); window.setTimeout(() => setToast(''), 4500); }
  const mark = (id: string, on: boolean) => setRunning((p) => { const n = new Set(p); if (on) n.add(id); else n.delete(id); return n; });

  const load = useCallback(async () => {
    try {
      const res = await listRecords({ objectKey: 'companies', limit: 100 });
      setRecords(res.records);
    } catch { /* no-op */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { getObject('companies').then((o) => { const a = (o.attributes as CrmAttribute[]).find((x) => x.aiEnabled && x.aiType === 'RESEARCH'); setResearchAttrId(a?.id ?? null); }).catch(() => {}); }, []);

  const researched = useMemo(() => records.filter((r) => txt(r.values?.ai_research)), [records]);
  const queue = useMemo(() => records.filter((r) => !txt(r.values?.ai_research)), [records]);
  const evidenceAvg = useMemo(() => {
    const vals = researched.map((r) => num(r.values?.icp_confidence)).filter((n) => n > 0);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  }, [researched]);

  const kpi = [
    { label: 'Researched', value: String(researched.length), icon: <FileSearch size={13} />, tone: 'text-emerald-600' },
    { label: 'In queue', value: String(queue.length), icon: <Bot size={13} />, tone: 'text-brand-600' },
    { label: 'Evidence conf', value: researched.length ? `${evidenceAvg}%` : '—', icon: <ShieldCheck size={13} />, tone: 'text-violet-600' },
    { label: 'Accounts', value: String(records.length), icon: <Gauge size={13} />, tone: 'text-ink-muted' },
  ];

  async function run(r: CrmRecord) {
    if (!researchAttrId) { showToast('No research field configured'); return; }
    mark(r.id, true);
    try {
      await runAiForRecord({ attributeId: researchAttrId, recordId: r.id, source: 'RECORD_PAGE' });
      window.dispatchEvent(new CustomEvent('credits:refresh'));
      showToast(`Agent researched ${r.displayName || 'account'}`);
      await load();
      setOpen((p) => new Set(p).add(r.id));
    } catch { showToast('Research run failed'); }
    finally { mark(r.id, false); }
  }
  function toggle(id: string) { setOpen((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }

  return (
    <>
      <Topbar title="Research Lab" subtitle="AI research engine · evidence + confidence" icon={<FlaskConical size={18} strokeWidth={1.85} />} />

      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-surface/70 px-4">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-700"><Bot size={13} /> {queue.length} account{queue.length === 1 ? '' : 's'} awaiting research</span>
        <span className="text-[11.5px] text-ink-subtle">· agent runs on DeepSeek (live), credits per run</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mb-4 flex items-stretch divide-x divide-line overflow-x-auto rounded-xl border border-line bg-surface shadow-xs">
          {kpi.map((k) => (
            <div key={k.label} className="flex min-w-[130px] flex-1 flex-col px-3 py-2.5">
              <span className={`mb-0.5 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.06em] ${k.tone}`}>{k.icon} {k.label}</span>
              <span className="text-[20px] font-extrabold leading-none tracking-[-0.02em] text-ink">{loading ? '—' : k.value}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {/* queue */}
          <section>
            <p className="mb-2 flex items-center gap-2 text-[12.5px] font-bold text-ink"><Bot size={14} className="text-brand-600" /> Research queue <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold text-ink-muted">{queue.length}</span></p>
            <div className="space-y-2">
              {loading ? [...Array(4)].map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />) : queue.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line py-8 text-center text-[12.5px] text-ink-subtle">Queue clear — every account is researched.</div>
              ) : queue.map((r, i) => (
                <div key={r.id} className="flex items-center gap-2.5 rounded-xl border border-line bg-surface p-3 shadow-xs">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-bold text-white shadow-sm ${TONES[i % TONES.length]}`}>{initials(r.displayName || 'A')}</span>
                  <button type="button" onClick={() => router.push('/data?obj=companies')} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-[13px] font-bold text-ink hover:text-brand-700">{r.displayName || 'Account'}</p>
                    <p className="truncate text-[11px] text-ink-subtle">{txt(r.values?.segment) || txt(r.values?.domain).replace(/^https?:\/\//, '') || '—'} · {num(r.values?.icp_fit) > 0 ? `ICP ${num(r.values?.icp_fit)}` : 'not scored'}</p>
                  </button>
                  <button type="button" onClick={() => run(r)} disabled={running.has(r.id)} className="brand-gradient inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[11.5px] font-semibold text-white shadow-brand hover:-translate-y-0.5 transition-all disabled:opacity-60">
                    {running.has(r.id) ? <Loader2 size={12} className="animate-spin" /> : <FlaskConical size={12} />} {running.has(r.id) ? 'Researching…' : 'Run research'}
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* dossiers */}
          <section>
            <p className="mb-2 flex items-center gap-2 text-[12.5px] font-bold text-ink"><FileSearch size={14} className="text-emerald-600" /> Dossiers <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold text-ink-muted">{researched.length}</span></p>
            <div className="space-y-2">
              {loading ? [...Array(2)].map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />) : researched.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line py-8 text-center text-[12.5px] text-ink-subtle">No dossiers yet — run research on a queued account.</div>
              ) : researched.map((r, i) => {
                const dossier = txt(r.values?.ai_research);
                const brief = txt(r.values?.ai_brief);
                const conf = num(r.values?.icp_confidence);
                const signals = Array.isArray(r.values?.signals) ? (r.values!.signals as unknown[]).map(String) : [];
                const isOpen = open.has(r.id);
                return (
                  <div key={r.id} className="rounded-xl border border-line bg-surface p-3 shadow-xs">
                    <div className="flex items-center gap-2.5">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-bold text-white shadow-sm ${TONES[i % TONES.length]}`}>{initials(r.displayName || 'A')}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-bold text-ink">{r.displayName || 'Account'}</p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {num(r.values?.icp_fit) > 0 && <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-700 ring-1 ring-inset ring-brand-100">ICP {num(r.values?.icp_fit)}</span>}
                          {conf > 0 && <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700"><ShieldCheck size={9} /> {conf}% conf</span>}
                        </div>
                      </div>
                      <button type="button" onClick={() => run(r)} disabled={running.has(r.id)} className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-line bg-surface px-2 text-[11px] font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-60">
                        {running.has(r.id) ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />} Re-run
                      </button>
                    </div>
                    {brief && <p className="mt-2 text-[11.5px] leading-4 text-ink-muted">{brief}</p>}
                    {signals.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {signals.slice(0, 4).map((s) => <span key={s} className="inline-flex items-center gap-1 rounded-md bg-orange-50 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700"><Flame size={9} /> {s}</span>)}
                      </div>
                    )}
                    <button type="button" onClick={() => toggle(r.id)} className="mt-2 inline-flex items-center gap-1 text-[10.5px] font-semibold text-ink-subtle hover:text-ink">
                      <ChevronDown size={11} className={isOpen ? '' : '-rotate-90'} /> Evidence dossier
                    </button>
                    {isOpen && <p className="mt-1 whitespace-pre-wrap rounded-lg bg-surface-2/60 p-2.5 text-[11.5px] leading-relaxed text-ink-muted">{dossier}</p>}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-5 right-5 z-[60] inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[12.5px] font-semibold text-ink shadow-lg">
          <span className="brand-gradient flex h-6 w-6 items-center justify-center rounded-lg text-white"><FlaskConical size={12} /></span>
          {toast}
        </div>
      )}
    </>
  );
}
