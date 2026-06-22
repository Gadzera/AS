'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { campaignsApi, playbooksApi, type SpineSection } from '@/lib/api';
import type { Campaign } from '@/types';
import {
  BookOpenCheck,
  Bot,
  Sparkles,
  Target,
  Users,
  Radar,
  MessageSquareText,
  ShieldQuestion,
  ListOrdered,
  ShieldCheck,
  GraduationCap,
  Layers,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Mail,
  X,
} from 'lucide-react';
import Topbar from '@/components/layout/Topbar';

/* ──────────────────────────────────────────────────────────────────────────
   Playbooks (/playbooks) — переиспользуемая стратегия исходящего. Плейбук ≈
   кампания; стратегия (spine) генерируется агентом из РЕАЛЬНЫХ агрегатов
   (/api/playbooks/:id/strategy, DeepSeek/grounded). Светлая Bold-тема. Мок
   (suggestions/perf/attention/dead tabs) вырезан.
   ────────────────────────────────────────────────────────────────────────── */

const SPINE_ICONS: Record<string, ReactNode> = {
  icp: <Target size={14} />, persona: <Users size={14} />, signals: <Radar size={14} />,
  messaging: <MessageSquareText size={14} />, objections: <ShieldQuestion size={14} />,
  sequence: <ListOrdered size={14} />, guardrails: <ShieldCheck size={14} />, learning: <GraduationCap size={14} />,
};
const STATUS_TONE: Record<string, string> = {
  Complete: 'bg-emerald-50 text-emerald-700', 'In use': 'bg-brand-50 text-brand-700',
  'Needs review': 'bg-rose-50 text-rose-600', 'Changed in draft': 'bg-violet-50 text-violet-700',
};

export default function PlaybooksPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [spine, setSpine] = useState<SpineSection[]>([]);
  const [genBy, setGenBy] = useState('');
  const [loading, setLoading] = useState(true);
  const [spineLoading, setSpineLoading] = useState(false);
  const [learningCtx, setLearningCtx] = useState<{ focus: string; title: string } | null>(null);

  const loadList = useCallback(async () => {
    try {
      const cs = await campaignsApi.list();
      setCampaigns(cs);
      // контекст из Learning: «Review in playbook» передаёт focus (сегмент инсайта) и title
      const sp = new URLSearchParams(window.location.search);
      const focus = (sp.get('focus') || '').trim();
      if (sp.get('from') === 'learning') setLearningCtx({ focus, title: (sp.get('title') || '').trim() });
      setSelectedId((id) => {
        if (id) return id;
        if (focus) {
          const f = focus.toLowerCase();
          const match = cs.find((c) => {
            const ind = (c.targetIndustry || '').toLowerCase();
            return ind && (f.includes(ind) || ind.includes(f));
          });
          if (match) return match.id;
        }
        return cs[0]?.id ?? null;
      });
    } catch { /* no-op */ } finally { setLoading(false); }
  }, []);
  const loadSpine = useCallback(async (id: string) => {
    setSpineLoading(true);
    try { const res = await playbooksApi.strategy(id); setSpine(res.spine ?? []); setGenBy(res.generatedBy); }
    catch { setSpine([]); } finally { setSpineLoading(false); }
  }, []);
  useEffect(() => { void loadList(); }, [loadList]);
  useEffect(() => { if (selectedId) void loadSpine(selectedId); }, [selectedId, loadSpine]);

  const selected = campaigns.find((c) => c.id === selectedId) ?? null;
  const enrolledOf = (c: Campaign) => c._count?.campaignLeads ?? 0;
  const stepsOf = (c: Campaign) => c._count?.sequences ?? 0;
  const uiStatus = (c?: Campaign | null) => (c?.status === 'ACTIVE' ? 'Active' : c?.status === 'DRAFT' ? 'Draft' : c?.status === 'PAUSED' ? 'Paused' : 'Archived');

  return (
    <>
      <Topbar title="Playbooks" subtitle="Intelligence · reusable outbound strategy" icon={<BookOpenCheck size={18} strokeWidth={1.85} />} />

      <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-line bg-surface/70 px-4">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-700"><Bot size={13} /> Agent authors strategy from {campaigns.length} campaign(s)</span>
        {genBy && <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700 ring-1 ring-inset ring-brand-100" title={`Strategy is authored by the agent from this campaign's real targeting, sequence and aggregates · engine: ${genBy === 'demo' ? 'grounded (offline)' : genBy}`}><Sparkles size={11} /> AI · grounded by campaign data</span>}
      </div>

      {/* контекст из Learning: оператор пришёл применить инсайт к плейбуку */}
      {learningCtx && (
        <div className="flex shrink-0 items-center gap-2 border-b border-violet-200 bg-violet-50 px-4 py-2">
          <GraduationCap size={14} className="shrink-0 text-violet-600" />
          <p className="min-w-0 flex-1 truncate text-[12px] text-violet-900">
            <span className="font-bold">From Learning</span> · applying insight{learningCtx.title ? ` “${learningCtx.title}”` : ''}{learningCtx.focus ? ` · focus: ${learningCtx.focus}` : ''} — review and update this playbook’s strategy below.
          </p>
          <button type="button" onClick={() => setLearningCtx(null)} className="shrink-0 rounded-md p-1 text-violet-500 hover:bg-violet-100" aria-label="Dismiss"><X size={13} /></button>
        </div>
      )}

      <div className="flex h-[calc(100vh-6.5rem)]">
        {/* playbooks rail */}
        <aside className="hidden w-[260px] shrink-0 flex-col overflow-y-auto border-r border-line bg-surface/60 p-2.5 lg:flex">
          <p className="px-1 pb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-subtle">Playbooks</p>
          <div className="space-y-1.5">
            {loading ? [...Array(4)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />) : campaigns.length === 0 ? (
              <p className="px-1 py-3 text-[11.5px] text-ink-subtle">No playbooks — create a campaign first.</p>
            ) : campaigns.map((c) => {
              const active = c.id === selectedId;
              return (
                <button key={c.id} type="button" onClick={() => setSelectedId(c.id)} className={['w-full rounded-xl border p-2.5 text-left transition-colors', active ? 'border-brand-200 bg-brand-50/70 ring-1 ring-inset ring-brand-100' : 'border-line bg-surface hover:bg-surface-2'].join(' ')}>
                  <div className="flex items-center justify-between gap-1.5">
                    <p className="truncate text-[12px] font-bold text-ink">{c.name}</p>
                    <span className="shrink-0 rounded bg-surface-2 px-1 text-[10px] font-bold text-ink-muted">v{Math.max(1, stepsOf(c))}</span>
                  </div>
                  <p className="truncate text-[10.5px] text-ink-subtle">{c.targetIndustry || 'General segment'}</p>
                  <div className="mt-1.5 flex items-center gap-2 text-[10px] text-ink-muted">
                    <span className={`rounded-full px-1.5 py-0.5 text-[9.5px] font-bold ${c.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : c.status === 'DRAFT' ? 'bg-surface-2 text-ink-muted' : 'bg-amber-100 text-amber-700'}`}>{uiStatus(c)}</span>
                    <span className="inline-flex items-center gap-1"><Users size={9} /> {enrolledOf(c)}</span>
                    <span className="inline-flex items-center gap-1"><ListOrdered size={9} /> {stepsOf(c)} steps</span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* center: brief + spine */}
        <section className="min-h-0 flex-1 overflow-y-auto">
          {!selected ? (
            <div className="flex h-full items-center justify-center text-[13px] text-ink-subtle">{loading ? 'Loading…' : 'Select a playbook'}</div>
          ) : (
            <div className="mx-auto max-w-4xl p-4">
              {/* brief */}
              <div className="mb-4 rounded-2xl border border-line bg-surface p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="brand-gradient flex h-9 w-9 items-center justify-center rounded-xl text-white"><BookOpenCheck size={16} /></span>
                  <div className="min-w-0 flex-1">
                    <h1 className="truncate text-[16px] font-extrabold tracking-[-0.01em] text-ink">{selected.name}</h1>
                    <p className="text-[12px] text-ink-muted">Reusable strategy · {selected.targetIndustry || 'general'} · {uiStatus(selected)}</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { l: 'Channel', v: selected.channel ?? 'EMAIL', icon: <Mail size={12} /> },
                    { l: 'Enrolled', v: `${enrolledOf(selected)} leads`, icon: <Users size={12} /> },
                    { l: 'Sequence', v: `${stepsOf(selected)} steps`, icon: <ListOrdered size={12} /> },
                    { l: 'Sections', v: `${spine.length} in spine`, icon: <Layers size={12} /> },
                  ].map((b) => (
                    <div key={b.l} className="rounded-lg border border-line bg-surface-2/40 px-3 py-2">
                      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.05em] text-ink-subtle">{b.icon} {b.l}</p>
                      <p className="mt-0.5 text-[12.5px] font-bold text-ink">{b.v}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* strategy spine */}
              <div className="mb-2 flex items-center gap-2">
                <Sparkles size={14} className="text-brand-600" />
                <h3 className="text-[12.5px] font-bold text-ink">Strategy spine</h3>
                <span className="text-[11px] text-ink-subtle">— agent-authored from real data</span>
                <button type="button" onClick={() => selectedId && loadSpine(selectedId)} disabled={spineLoading} className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-lg bg-brand-600 px-2.5 text-[11.5px] font-semibold text-white shadow-brand hover:bg-brand-700 disabled:opacity-60">
                  {spineLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Regenerate
                </button>
              </div>

              {spineLoading && spine.length === 0 ? (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-32 rounded-xl" />)}</div>
              ) : spine.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line py-10 text-center text-[12.5px] text-ink-subtle">No strategy yet — Regenerate to let the agent author it.</div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {spine.map((s) => (
                    <div key={s.key} className="rounded-xl border border-line bg-surface p-3 shadow-xs">
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600">{SPINE_ICONS[s.key] ?? <Layers size={14} />}</span>
                        <p className="flex-1 truncate text-[12.5px] font-bold text-ink">{s.title}</p>
                        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${STATUS_TONE[s.status] ?? 'bg-surface-2 text-ink-muted'}`}>{s.status}</span>
                      </div>
                      <ul className="space-y-1">
                        {s.items.map((it, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-[11.5px] leading-4 text-ink-muted">
                            <CheckCircle2 size={11} className="mt-0.5 shrink-0 text-emerald-500" /> {it}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-ink-subtle">
                <AlertTriangle size={13} className="text-amber-500" />
                Strategy is generated from this campaign’s real targeting, sequence and aggregates. Learning insights feed back into it.
              </p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
