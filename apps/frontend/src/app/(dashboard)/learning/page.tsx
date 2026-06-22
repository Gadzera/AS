'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { overviewApi, outreachApi, insightsApi, type LearningInsight } from '@/lib/api';
import {
  GraduationCap,
  Bot,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  Reply,
  CalendarCheck,
  Target,
  Gauge,
  ThumbsDown,
  Lightbulb,
  Layers,
  ArrowUpRight,
  Loader2,
} from 'lucide-react';
import Topbar from '@/components/layout/Topbar';

/* ──────────────────────────────────────────────────────────────────────────
   Learning (/learning) — Agent Learning Console. Главная единица — Learning
   Insight: проверяемое утверждение с evidence + counter-evidence + confidence
   + recommended action. Всё на ЖИВЫХ данных (/api/insights — из реальных
   агрегатов; /api/overview + /outreach/replies — proof-метрики). Learning только
   ПРЕДЛАГАЕТ; применяется в Playbooks. Мок (attention/scopes/tabs/feedback,
   мёртвые Approve/Reject) вырезан. Светлая Bold-тема.
   ────────────────────────────────────────────────────────────────────────── */

function confTone(v: number): string {
  if (v >= 85) return 'bg-emerald-100 text-emerald-700 ring-emerald-200';
  if (v >= 60) return 'bg-amber-100 text-amber-700 ring-amber-200';
  return 'bg-rose-100 text-rose-700 ring-rose-200';
}
function statusTone(status: string): string {
  if (/promote|ready/i.test(status)) return 'bg-emerald-50 text-emerald-700';
  if (/data/i.test(status)) return 'bg-amber-50 text-amber-700';
  return 'bg-rose-50 text-rose-600';
}

export default function LearningPage() {
  const router = useRouter();
  const [insights, setInsights] = useState<LearningInsight[]>([]);
  const [genBy, setGenBy] = useState('');
  const [proof, setProof] = useState<{ label: string; value: string; icon: ReactNode }[]>([]);
  const [acked, setAcked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([overviewApi.get().catch(() => null), outreachApi.replies().catch(() => null)]).then(([o, r]) => {
      const total = r?.replies.length ?? 0;
      const interested = r?.counts?.INTERESTED ?? 0;
      setProof([
        { label: 'Replies processed', value: String(total), icon: <Reply size={12} /> },
        { label: 'Interested rate', value: total ? `${Math.round((interested / total) * 100)}%` : '0%', icon: <CheckCircle2 size={12} /> },
        { label: 'AI runs', value: String(o?.ai.runsTotal ?? 0), icon: <Sparkles size={12} /> },
        { label: 'Records enriched', value: String(o?.records.total ?? 0), icon: <Target size={12} /> },
        { label: 'Credits used', value: String(o?.ai.credits.used ?? 0), icon: <Gauge size={12} /> },
        { label: 'Active campaigns', value: String(o?.campaigns.active ?? 0), icon: <CalendarCheck size={12} /> },
      ]);
    });
  }, []);

  useEffect(() => {
    insightsApi.get().then((res) => {
      const list = res.insights ?? [];
      setInsights(list);
      setGenBy(res.generatedBy);
      // восстанавливаем отметки «просмотрено» из персистентного состояния (insight_acks)
      setAcked(new Set(list.filter((i) => i.acknowledged).map((i) => i.id)));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // тоггл «просмотрено» с персистом на backend (оптимистично, с откатом при ошибке)
  const toggleAck = async (ins: LearningInsight) => {
    const next = !acked.has(ins.id);
    setAcked((p) => { const n = new Set(p); if (next) n.add(ins.id); else n.delete(ins.id); return n; });
    try { await insightsApi.ack(ins.key, next); }
    catch { setAcked((p) => { const n = new Set(p); if (next) n.delete(ins.id); else n.add(ins.id); return n; }); }
  };

  const needsReview = useMemo(() => insights.filter((i) => /review/i.test(i.status)).length, [insights]);

  return (
    <>
      <Topbar title="Learning" subtitle="Intelligence · what the agent learned" icon={<GraduationCap size={18} strokeWidth={1.85} />} />

      <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-line bg-surface/70 px-4">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-700"><Bot size={13} /> {insights.length} insight(s) · {needsReview} need review</span>
        {genBy && <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700 ring-1 ring-inset ring-brand-100" title={`Insights are derived by the agent from real outcomes (replies, AI runs, campaign aggregates) · engine: ${genBy === 'demo' ? 'grounded (offline)' : genBy}`}><Sparkles size={11} /> AI · grounded by outcomes</span>}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {/* proof strip */}
        <div className="mb-4 flex items-stretch divide-x divide-line overflow-x-auto rounded-xl border border-line bg-surface shadow-xs">
          {proof.length === 0 ? [...Array(6)].map((_, i) => <div key={i} className="min-w-[120px] flex-1 px-3 py-2.5"><div className="skeleton h-8 rounded" /></div>) : proof.map((p) => (
            <div key={p.label} className="flex min-w-[120px] flex-1 flex-col px-3 py-2.5">
              <span className="mb-0.5 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">{p.icon} {p.label}</span>
              <span className="text-[18px] font-extrabold leading-none tracking-[-0.02em] text-ink">{p.value}</span>
            </div>
          ))}
        </div>

        <div className="mb-2 flex items-center gap-2">
          <Sparkles size={14} className="text-brand-600" />
          <h3 className="text-[12.5px] font-bold text-ink">Learning insights</h3>
          <span className="text-[11px] text-ink-subtle">— verifiable claims from real outcomes; apply in Playbooks</span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">{[...Array(2)].map((_, i) => <div key={i} className="skeleton h-64 rounded-xl" />)}</div>
        ) : insights.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line py-12 text-center text-[12.5px] text-ink-subtle">No insights yet — the agent learns as it processes more replies and runs.</div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {insights.map((ins) => {
              const isAck = acked.has(ins.id);
              return (
                <div key={ins.id} className={['rounded-xl border bg-surface p-3.5 shadow-xs transition-colors', isAck ? 'border-emerald-200 ring-1 ring-inset ring-emerald-100' : 'border-line'].join(' ')}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13.5px] font-bold leading-snug text-ink">{ins.title}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusTone(ins.status)}`}>{ins.status}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700"><Sparkles size={9} /> {ins.type}</span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-ink-muted"><Layers size={9} /> {ins.scope}</span>
                    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10.5px] font-bold ring-1 ring-inset ${confTone(ins.conf)}`}>{ins.conf}% confidence</span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-700"><TrendingUp size={9} /> {ins.impact}</span>
                  </div>

                  <div className="mt-2.5 rounded-lg bg-surface-2/50 p-2.5">
                    <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-ink-subtle">What the agent learned</p>
                    <p className="text-[11.5px] leading-4 text-ink">{ins.learned}</p>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {ins.evidence.map((e) => (
                      <span key={e.label} className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-1.5 py-0.5 text-[10px] font-medium text-ink-muted">
                        <span className="font-bold text-ink">{e.value}</span> {e.label}
                      </span>
                    ))}
                    {ins.validated && <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700"><CheckCircle2 size={9} /> {ins.validated}</span>}
                  </div>

                  {ins.why && <p className="mt-2 text-[11px] leading-4 text-ink-muted"><span className="font-bold text-ink">Why:</span> {ins.why}</p>}

                  {ins.counter && (
                    <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50/60 px-2 py-1.5">
                      <ThumbsDown size={12} className="mt-0.5 shrink-0 text-amber-600" />
                      <p className="text-[11px] leading-4 text-amber-800"><span className="font-bold">Counter-evidence:</span> {ins.counter}</p>
                    </div>
                  )}

                  {ins.rec && (
                    <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-brand-50/60 px-2 py-1.5">
                      <Lightbulb size={12} className="shrink-0 text-brand-600" />
                      <p className="min-w-0 flex-1 text-[11px] font-semibold text-brand-900">Recommended: {ins.rec}</p>
                    </div>
                  )}

                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <button type="button" onClick={() => router.push(`/playbooks?from=learning&focus=${encodeURIComponent(ins.scope)}&title=${encodeURIComponent(ins.title)}`)} className="brand-gradient inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11.5px] font-semibold text-white shadow-brand hover:-translate-y-0.5 transition-all"><ArrowUpRight size={13} /> Review in playbook</button>
                    <button type="button" onClick={() => void toggleAck(ins)} className={['inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-medium transition-colors', isAck ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-line text-ink-muted hover:bg-surface-2'].join(' ')}>
                      <CheckCircle2 size={12} /> {isAck ? 'Reviewed' : 'Mark reviewed'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-ink-subtle">
          <Loader2 size={13} className="text-brand-500" />
          Insights are generated from real outcomes (replies, AI runs, campaign aggregates). Learning proposes; you apply changes in Playbooks.
        </p>
      </div>
    </>
  );
}
