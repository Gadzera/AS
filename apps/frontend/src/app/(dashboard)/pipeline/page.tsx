'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  Radar,
  LayoutGrid,
  Table2,
  Bot,
  Flame,
  CalendarCheck,
  AlertTriangle,
  ArrowRight,
  Loader2,
  Sparkles,
} from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import { listRecords, bulkStageRecords, type CrmRecord, type CrmRecordValue, AGENT_STAGES } from '@/lib/crmApi';

/* ──────────────────────────────────────────────────────────────────────────
   Pipeline Radar (/pipeline) — доска исходящего мотиона по РЕАЛЬНОМУ полю
   agent_stage (то, что ставит «Push to Pipeline» в Data Hub). Стадии, счётчики,
   карточки — из backend; перевод между стадиями (bulkStageRecords) меняет
   состояние наблюдаемо. Светлая Bold-тема.
   ────────────────────────────────────────────────────────────────────────── */

type View = 'board' | 'table';

interface Lane { key: string; label: string; tone: string }
const PIPELINE: Lane[] = [
  { key: 'sourced', label: 'Sourced', tone: 'text-ink-muted' },
  { key: 'researching', label: 'Researching', tone: 'text-cyan-600' },
  { key: 'ready_to_engage', label: 'Ready to engage', tone: 'text-emerald-600' },
  { key: 'engaging', label: 'Engaging', tone: 'text-violet-600' },
  { key: 'in_conversation', label: 'In conversation', tone: 'text-brand-600' },
  { key: 'meeting_set', label: 'Meeting set', tone: 'text-emerald-700' },
  { key: 'handed_off', label: 'Handed off', tone: 'text-brand-700' },
];
const TERMINAL: Lane[] = [
  { key: 'nurture', label: 'Nurture', tone: 'text-amber-600' },
  { key: 'recycle', label: 'Recycle', tone: 'text-brand-600' },
  { key: 'suppressed', label: 'Suppressed', tone: 'text-ink-subtle' },
  { key: 'disqualified', label: 'Disqualified', tone: 'text-rose-500' },
];
const STAGE_LABEL: Record<string, string> = Object.fromEntries([...PIPELINE, ...TERMINAL].map((l) => [l.key, l.label]));
const PIPE_TONES = ['from-[#6366f1] to-[#8b5cf6]', 'from-[#06b6d4] to-[#4f46e5]', 'from-[#8b5cf6] to-[#d946ef]', 'from-[#10b981] to-[#06b6d4]', 'from-[#f59e0b] to-[#f43f5e]', 'from-[#f43f5e] to-[#8b5cf6]'];

function txt(v: CrmRecordValue | undefined): string {
  if (v == null) return '';
  if (Array.isArray(v)) return v.map((x) => txt(x as CrmRecordValue)).filter(Boolean).join(', ');
  if (typeof v === 'object') { const o = v as Record<string, unknown>; return String(o.displayName ?? o.name ?? o.label ?? o.value ?? ''); }
  return String(v);
}
function num(v: CrmRecordValue | undefined): number {
  const n = Number(txt(v));
  return isNaN(n) ? 0 : n;
}
function initials(n: string) { return (n || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase(); }
// Реальная стадия записи: agent_stage; пустая → entry-стадия 'sourced'.
function stageOf(r: CrmRecord): string {
  const s = txt(r.values?.agent_stage).trim();
  return s && STAGE_LABEL[s] ? s : 'sourced';
}

function Avatar({ name, i, size = 26 }: { name: string; i: number; size?: number }) {
  return <span className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[10.5px] font-bold text-white shadow-sm ${PIPE_TONES[i % PIPE_TONES.length]}`} style={{ width: size, height: size }}>{initials(name)}</span>;
}

export default function PipelineRadarPage() {
  const router = useRouter();
  const [records, setRecords] = useState<CrmRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('board');
  const [moving, setMoving] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState('');

  function showToast(m: string) { setToast(m); window.setTimeout(() => setToast(''), 4000); }

  const load = useCallback(async () => {
    try {
      const res = await listRecords({ objectKey: 'companies', limit: 100 });
      setRecords(res.records);
    } catch { /* no-op */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const byStage = useMemo(() => {
    const map: Record<string, CrmRecord[]> = {};
    for (const r of records) { const s = stageOf(r); (map[s] ??= []).push(r); }
    return map;
  }, [records]);

  const count = (k: string) => byStage[k]?.length ?? 0;
  const inPipeline = PIPELINE.reduce((s, l) => s + count(l.key), 0);

  // Реальные KPI-метрики мотиона.
  const pulse = [
    { label: 'In pipeline', value: String(inPipeline), sub: 'active accounts', icon: <Radar size={13} />, tone: 'text-brand-600' },
    { label: 'Ready to engage', value: String(count('ready_to_engage')), sub: 'qualified', icon: <Bot size={13} />, tone: 'text-emerald-600' },
    { label: 'In conversation', value: String(count('in_conversation')), sub: 'replied · in dialogue', icon: <Flame size={13} />, tone: 'text-orange-500' },
    { label: 'Meetings set', value: String(count('meeting_set')), sub: 'booked', icon: <CalendarCheck size={13} />, tone: 'text-brand-600' },
    { label: 'Handed off', value: String(count('handed_off')), sub: 'to AE', icon: <ArrowRight size={13} />, tone: 'text-violet-600' },
    { label: 'Off-pipeline', value: String(TERMINAL.reduce((s, l) => s + count(l.key), 0)), sub: 'nurture/recycle/supp.', icon: <AlertTriangle size={13} />, tone: 'text-amber-600' },
  ];

  async function move(r: CrmRecord, stage: string) {
    if (stage === stageOf(r)) return;
    setMoving((p) => new Set(p).add(r.id));
    try {
      await bulkStageRecords({ objectKey: 'companies', ids: [r.id], stage });
      // оптимистично + перезагрузка с backend
      setRecords((rs) => rs.map((x) => (x.id === r.id ? { ...x, values: { ...x.values, agent_stage: stage } } : x)));
      showToast(`${r.displayName || 'Account'} → ${STAGE_LABEL[stage]}`);
      await load();
    } catch { showToast('Could not move account'); }
    finally { setMoving((p) => { const n = new Set(p); n.delete(r.id); return n; }); }
  }

  return (
    <>
      <Topbar title="Pipeline Radar" subtitle="Outbound motion · live agent_stage" icon={<Radar size={18} strokeWidth={1.85} />} />

      {/* control bar */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-surface/70 px-4">
        <span className="text-[12.5px] font-semibold text-ink">{records.length} accounts · {inPipeline} in pipeline</span>
        <button type="button" onClick={() => router.push('/data')} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-[12px] font-medium text-ink-muted shadow-xs hover:bg-surface-2"><Sparkles size={13} /> Push from Data Hub</button>
        <div className="ml-auto inline-flex h-8 items-center gap-0.5 rounded-lg border border-line bg-surface-2/60 p-0.5 shadow-xs">
          {([['board', 'Board', <LayoutGrid key="b" size={13} />], ['table', 'Table', <Table2 key="t" size={13} />]] as [View, string, ReactNode][]).map(([k, label, icon]) => (
            <button key={k} type="button" onClick={() => setView(k)} className={['inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-semibold transition-colors', view === k ? 'bg-surface text-brand-700 shadow-xs ring-1 ring-inset ring-brand-100' : 'text-ink-muted hover:text-ink'].join(' ')}>{icon} {label}</button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {/* pulse */}
        <div className="mb-3 flex items-stretch divide-x divide-line overflow-x-auto rounded-xl border border-line bg-surface shadow-xs">
          {pulse.map((p) => (
            <div key={p.label} className="flex min-w-[130px] flex-1 flex-col px-3 py-2.5">
              <span className={`mb-0.5 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.06em] ${p.tone}`}>{p.icon} {p.label}</span>
              <span className="text-[20px] font-extrabold leading-none tracking-[-0.02em] text-ink">{loading ? '—' : p.value}</span>
              <span className="mt-0.5 truncate text-[10.5px] text-ink-subtle">{p.sub}</span>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-[13px] text-ink-subtle"><Loader2 size={16} className="animate-spin" /> Loading pipeline…</div>
        ) : view === 'board' ? (
          <>
            {/* pipeline lanes */}
            <div className="flex gap-2.5 overflow-x-auto pb-2">
              {PIPELINE.map((lane) => {
                const items = byStage[lane.key] ?? [];
                return (
                  <div key={lane.key} className="flex w-[230px] shrink-0 flex-col">
                    <div className="mb-1.5 flex items-center justify-between px-0.5">
                      <p className={`truncate text-[11.5px] font-bold ${lane.tone}`}>{lane.label}</p>
                      <span className="shrink-0 rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold text-ink-muted">{items.length}</span>
                    </div>
                    <div className="space-y-2">
                      {items.map((r, i) => (
                        <PipeCard key={r.id} r={r} i={i} moving={moving.has(r.id)} onMove={(s) => move(r, s)} onOpen={() => router.push(`/data?obj=companies`)} />
                      ))}
                      {items.length === 0 && <div className="rounded-lg border border-dashed border-line/70 py-3 text-center text-[11px] text-ink-subtle">empty</div>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* terminal lanes */}
            <div className="mt-4">
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-subtle">Off-pipeline outcomes</p>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {TERMINAL.map((lane) => {
                  const items = byStage[lane.key] ?? [];
                  return (
                    <div key={lane.key} className="rounded-xl border border-line bg-surface p-3 shadow-xs">
                      <div className="mb-1.5 flex items-center justify-between">
                        <p className={`text-[12px] font-bold ${lane.tone}`}>{lane.label}</p>
                        <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold text-ink-muted">{items.length}</span>
                      </div>
                      <div className="space-y-1">
                        {items.slice(0, 3).map((r, i) => (
                          <div key={r.id} className="flex items-center gap-1.5 truncate text-[11.5px] text-ink-muted"><Avatar name={r.displayName || 'A'} i={i} size={18} />{r.displayName}</div>
                        ))}
                        {items.length === 0 && <p className="text-[11px] text-ink-subtle">—</p>}
                        {items.length > 3 && <p className="text-[10.5px] text-ink-subtle">+{items.length - 3} more</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          /* table */
          <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
            <div className="grid grid-cols-[1.6fr_1fr_0.6fr_auto] items-center gap-3 border-b border-line bg-surface-2/40 px-4 py-2 text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-subtle">
              <span>Account</span><span>Stage</span><span>ICP fit</span><span className="text-right">Move to</span>
            </div>
            {records.map((r, i) => (
              <div key={r.id} className="grid grid-cols-[1.6fr_1fr_0.6fr_auto] items-center gap-3 border-b border-line px-4 py-2 last:border-b-0 hover:bg-brand-50/30">
                <div className="flex items-center gap-2"><Avatar name={r.displayName || 'A'} i={i} size={24} /><span className="truncate text-[13px] font-semibold text-ink">{r.displayName}</span></div>
                <span className="text-[12px] text-ink-muted">{STAGE_LABEL[stageOf(r)]}</span>
                <span className="text-[12px] font-semibold text-brand-700">{num(r.values?.icp_fit) || '—'}</span>
                <div className="flex justify-end"><StageSelect value={stageOf(r)} disabled={moving.has(r.id)} onChange={(s) => move(r, s)} /></div>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-5 right-5 z-[60] inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[12.5px] font-semibold text-ink shadow-lg">
          <span className="brand-gradient flex h-6 w-6 items-center justify-center rounded-lg text-white"><Radar size={12} /></span>
          {toast}
        </div>
      )}
    </>
  );
}

function StageSelect({ value, onChange, disabled }: { value: string; onChange: (s: string) => void; disabled?: boolean }) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="h-7 rounded-md border border-line bg-surface px-2 text-[11.5px] font-medium text-ink-muted outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:opacity-50"
    >
      {AGENT_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s] ?? s}</option>)}
    </select>
  );
}

function PipeCard({ r, i, moving, onMove, onOpen }: { r: CrmRecord; i: number; moving: boolean; onMove: (s: string) => void; onOpen: () => void }) {
  const v = r.values ?? {};
  const icp = num(v.icp_fit);
  const seg = txt(v.segment) || txt(v.domain).replace(/^https?:\/\//, '').replace(/\/$/, '');
  const last = txt(v.last_agent_action);
  return (
    <div className="rounded-xl border border-line bg-surface p-2.5 shadow-xs transition-shadow hover:shadow-sm">
      <div className="flex items-center gap-2">
        <Avatar name={r.displayName || 'A'} i={i} />
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <p className="truncate text-[12px] font-bold text-ink hover:text-brand-700">{r.displayName || 'Account'}</p>
          <p className="truncate text-[10.5px] text-ink-subtle">{seg || '—'}</p>
        </button>
        {moving && <Loader2 size={13} className="animate-spin text-brand-600" />}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        {icp > 0 && <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-700 ring-1 ring-inset ring-brand-100">ICP {icp}</span>}
        {last && <span className="truncate rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-ink-muted">{last}</span>}
      </div>
      <div className="mt-1.5">
        <StageSelect value={stageOf(r)} disabled={moving} onChange={onMove} />
      </div>
    </div>
  );
}
