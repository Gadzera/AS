'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence } from 'framer-motion';
import { campaignsApi, sequencesApi, outreachApi, analyticsApi } from '@/lib/api';
import type { Campaign, Sequence, CampaignStats } from '@/types';
import CreateCampaignModal from '@/components/outreach/CreateCampaignModal';
import {
  Send,
  Megaphone,
  Bot,
  Sparkles,
  Mail,
  Clock3,
  Linkedin,
  Users,
  Target,
  ShieldCheck,
  Plus,
  Play,
  Pause,
  Loader2,
} from 'lucide-react';
import Topbar from '@/components/layout/Topbar';

/* ──────────────────────────────────────────────────────────────────────────
   Outreach Studio (/campaigns) — mission control исходящих кампаний. Всё на
   ЖИВОМ backend: список кампаний, brief из реальных полей, KPI, AI-sequence
   (генерация/шаги), получатели (enrollment), старт/пауза, run-now. Светлая
   Bold-тема. Мёртвых/мок-элементов нет (легаси optimization-рейл вырезан).
   ────────────────────────────────────────────────────────────────────────── */

type UiStatus = 'Running' | 'Paused' | 'Draft' | 'Completed';
const STATUS_MAP: Record<string, UiStatus> = { ACTIVE: 'Running', PAUSED: 'Paused', DRAFT: 'Draft', COMPLETED: 'Completed' };
const statusTone: Record<UiStatus, string> = {
  Running: 'bg-emerald-100 text-emerald-700',
  Paused: 'bg-amber-100 text-amber-700',
  Draft: 'bg-surface-2 text-ink-muted',
  Completed: 'bg-brand-100 text-brand-700',
};

interface UiStep { id: string; kind: 'email' | 'linkedin' | 'wait'; title: string; goal: string; schedule: string; channel: string }
function seqToSteps(seqs: Sequence[]): UiStep[] {
  const sorted = [...seqs].sort((a, b) => a.stepNumber - b.stepNumber);
  const out: UiStep[] = [];
  for (const s of sorted) {
    if (s.delayDays > 0) out.push({ id: `w-${s.id}`, kind: 'wait', title: `Wait ${s.delayDays} day${s.delayDays > 1 ? 's' : ''}`, goal: '', schedule: 'business days', channel: '' });
    const kind: UiStep['kind'] = String(s.channel).toUpperCase() === 'LINKEDIN' ? 'linkedin' : 'email';
    const body = (s.body || '').replace(/\s+/g, ' ').trim();
    out.push({ id: s.id, kind, title: `${kind === 'linkedin' ? 'LinkedIn' : 'Email'} · ${s.subject || `Step ${s.stepNumber}`}`, goal: body ? body.slice(0, 100) + (body.length > 100 ? '…' : '') : 'Outreach touch', schedule: `Day ${s.delayDays}`, channel: s.channel });
  }
  return out;
}
const stepIcon: Record<UiStep['kind'], ReactNode> = { email: <Mail size={14} />, linkedin: <Linkedin size={14} />, wait: <Clock3 size={14} /> };

export default function OutreachStudioPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Campaign | null>(null);
  const [steps, setSteps] = useState<UiStep[]>([]);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [genBusy, setGenBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState('');

  function showToast(m: string) { setToast(m); window.setTimeout(() => setToast(''), 4000); }

  const loadList = useCallback(async () => {
    try {
      const cs = await campaignsApi.list();
      setCampaigns(cs);
      setSelectedId((id) => id ?? cs[0]?.id ?? null);
    } catch { /* no-op */ } finally { setLoading(false); }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    try {
      const [c, seqs] = await Promise.all([campaignsApi.get(id), sequencesApi.list(id).catch(() => [] as Sequence[])]);
      setDetail(c);
      setSteps(seqToSteps(seqs));
      analyticsApi.campaignStats(id).then(setStats).catch(() => setStats(null));
    } catch { setDetail(null); setSteps([]); }
  }, []);

  useEffect(() => { void loadList(); }, [loadList]);
  useEffect(() => { if (selectedId) void loadDetail(selectedId); }, [selectedId, loadDetail]);

  // Deep-link ?new=1 (командная палитра).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).get('new') === '1') setShowCreate(true);
    const onNew = () => setShowCreate(true);
    window.addEventListener('campaigns:new', onNew);
    return () => window.removeEventListener('campaigns:new', onNew);
  }, []);

  const uiStatus = (c?: Campaign | null): UiStatus => (c ? STATUS_MAP[c.status] ?? 'Draft' : 'Draft');
  const enrolledOf = (c: Campaign) => c._count?.campaignLeads ?? c.campaignLeads?.length ?? 0;
  const recipients = detail?.campaignLeads ?? [];

  const kpis = useMemo(() => {
    const total = campaigns.length;
    const active = campaigns.filter((c) => c.status === 'ACTIVE').length;
    const enrolled = campaigns.reduce((s, c) => s + enrolledOf(c), 0);
    return [
      { label: 'Campaigns', value: String(total) },
      { label: 'Active', value: String(active) },
      { label: 'Enrolled', value: enrolled.toLocaleString() },
      { label: 'Sequence steps', value: String(steps.filter((s) => s.kind !== 'wait').length) },
      { label: 'Recipients', value: String(recipients.length) },
      { label: 'Messages', value: String(stats?.totalMessages ?? 0) },
    ];
  }, [campaigns, steps, recipients.length, stats]);

  const selected = detail ?? campaigns.find((c) => c.id === selectedId) ?? null;
  const isRunning = selected?.status === 'ACTIVE';

  async function toggleRun() {
    if (!selected) return;
    setBusy(true);
    try {
      if (selected.status === 'ACTIVE') { const r = await campaignsApi.pause(selected.id); showToast(`Campaign paused · ${r.enrollmentsPaused} on hold`); }
      else if (selected.status === 'PAUSED') { const r = await campaignsApi.resume(selected.id); showToast(`Campaign resumed · ${r.enrollmentsResumed} re-scheduled`); }
      else { const r = await campaignsApi.start(selected.id); showToast(`Campaign started · ${r.leadsEnrolled} enrolled`); }
      await loadList(); await loadDetail(selected.id);
    } catch { showToast('Start needs a sequence + enrolled leads'); }
    finally { setBusy(false); }
  }

  async function runNow() {
    if (!selected) return;
    if (selected.status !== 'ACTIVE') { showToast('Start the campaign before running'); return; }
    setRunning(true);
    try {
      const r = await outreachApi.runNow(selected.id, 25);
      showToast(`Agent processed ${r.processed} · recorded ${r.sent} send${r.sent === 1 ? '' : 's'} (demo)`);
      await loadDetail(selected.id);
    } catch { showToast('Run failed — needs active leads + sequence'); }
    finally { setRunning(false); }
  }

  async function genSequence() {
    if (!selected || genBusy) return;
    setGenBusy(true);
    try {
      const r = await sequencesApi.generate(selected.id, { replace: steps.length > 0 });
      setSteps(seqToSteps(r.sequences as Sequence[]));
      showToast(`Agent authored ${r.sequences.length} step(s) · ${r.generatedBy === 'demo' ? 'demo template' : r.generatedBy}`);
    } catch { showToast('Could not generate sequence'); }
    finally { setGenBusy(false); }
  }

  return (
    <>
      <Topbar
        title="Outreach Studio"
        subtitle="Outbound motion · AI-authored campaigns"
        icon={<Megaphone size={18} strokeWidth={1.85} />}
        actions={
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={toggleRun} disabled={busy || !selected} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-[12.5px] font-medium text-ink-muted shadow-xs hover:bg-surface-2 disabled:opacity-60">
              {busy ? <Loader2 size={14} className="animate-spin" /> : isRunning ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Start</>}
            </button>
            <button type="button" onClick={runNow} disabled={running || !selected || !isRunning} title={!isRunning ? 'Start the campaign before running' : 'Process the next send batch now (demo delivery)'} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 text-[12.5px] font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:border disabled:border-line disabled:bg-surface-2 disabled:text-ink-subtle disabled:shadow-none disabled:hover:bg-surface-2">
              {running ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} {running ? 'Running…' : 'Run agent now'}
            </button>
            <button type="button" onClick={() => setShowCreate(true)} className="brand-gradient inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold text-white shadow-brand hover:-translate-y-0.5 hover:shadow-lg transition-all">
              <Plus size={14} strokeWidth={2.4} /> New campaign
            </button>
          </div>
        }
      />

      <div className="flex h-[calc(100vh-3.5rem)]">
        {/* Campaign rail */}
        <aside className="hidden w-[280px] shrink-0 flex-col overflow-y-auto border-r border-line bg-surface/60 p-2.5 lg:flex">
          <div className="flex items-center justify-between px-1 pb-1.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-subtle">Campaigns</p>
            <span className="text-[10.5px] text-ink-subtle">{campaigns.length}</span>
          </div>
          <div className="space-y-1.5">
            {loading ? (
              [...Array(4)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)
            ) : campaigns.length === 0 ? (
              <p className="px-1 py-3 text-[11.5px] text-ink-subtle">No campaigns yet — create one.</p>
            ) : campaigns.map((c) => {
              const active = c.id === selectedId;
              const st = uiStatus(c);
              return (
                <button key={c.id} type="button" onClick={() => setSelectedId(c.id)} className={['w-full rounded-xl border p-2.5 text-left transition-colors', active ? 'border-brand-200 bg-brand-50/70 ring-1 ring-inset ring-brand-100' : 'border-line bg-surface hover:bg-surface-2'].join(' ')}>
                  <p className="truncate text-[12px] font-bold text-ink">{c.name}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${statusTone[st]}`}>{st}</span>
                    <span className="text-[10.5px] text-ink-subtle">{enrolledOf(c)} enrolled</span>
                  </div>
                  <p className="mt-1.5 inline-flex items-center gap-1 text-[10.5px] text-ink-subtle">
                    <Bot size={10} className="shrink-0 text-brand-500" />
                    <span className="truncate">{c.status === 'ACTIVE' ? 'Agent running outreach' : c.status === 'DRAFT' ? 'Draft — needs sequence' : c.status === 'PAUSED' ? 'Paused' : 'Completed'}</span>
                  </p>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Center */}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center text-[13px] text-ink-subtle">{loading ? 'Loading…' : 'Create or select a campaign'}</div>
          ) : (
            <>
              {/* status bar */}
              <div className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-surface/70 px-4">
                <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-ink">
                  {isRunning && <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>}
                  {selected.name}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${statusTone[uiStatus(selected)]}`}>{uiStatus(selected)}</span>
                <span className="inline-flex items-center gap-1 text-[12px] font-medium text-ink-muted"><Bot size={13} className="text-brand-500" /> {isRunning ? 'Agent running' : 'Agent idle'}</span>
              </div>

              {/* brief — реальные поля кампании */}
              <div className="shrink-0 border-b border-line bg-surface/40 px-4 py-2.5">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 xl:grid-cols-3">
                  <Brief icon={<Mail size={12} />} label="Channel" value={selected.channel ?? 'EMAIL'} />
                  <Brief icon={<Target size={12} />} label="Target industry" value={selected.targetIndustry || '— any —'} />
                  <Brief icon={<Users size={12} />} label="Enrolled" value={`${enrolledOf(selected)} leads`} />
                  <Brief icon={<Sparkles size={12} />} label="Sequence" value={`${steps.filter((s) => s.kind !== 'wait').length} step(s)`} />
                  <Brief icon={<ShieldCheck size={12} />} label="Approval" value="Auto high-confidence · human-approve replies" />
                  <Brief icon={<Clock3 size={12} />} label="Status" value={uiStatus(selected)} />
                </div>
              </div>

              {/* KPI */}
              <div className="flex shrink-0 items-stretch divide-x divide-line overflow-x-auto border-b border-line bg-surface">
                {kpis.map((k) => (
                  <div key={k.label} className="flex min-w-[96px] flex-1 flex-col px-3 py-2">
                    <span className="text-[15px] font-extrabold leading-none tracking-[-0.02em] text-ink">{k.value}</span>
                    <span className="mt-1 truncate text-[10px] font-medium uppercase tracking-[0.04em] text-ink-subtle">{k.label}</span>
                  </div>
                ))}
              </div>

              {/* body: sequence + recipients */}
              <div className="flex min-h-0 flex-1">
                {/* sequence */}
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Sparkles size={14} className="text-brand-600" />
                    <h3 className="text-[12.5px] font-bold text-ink">Agent-authored sequence</h3>
                    <button type="button" onClick={genSequence} disabled={genBusy} className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-lg bg-brand-600 px-2.5 text-[11.5px] font-semibold text-white shadow-brand hover:bg-brand-700 disabled:opacity-60">
                      {genBusy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} {steps.length ? 'Regenerate' : 'Generate with AI'}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {steps.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-line py-8 text-center">
                        <p className="text-[12px] text-ink-subtle">No sequence steps yet.</p>
                        <button type="button" onClick={genSequence} disabled={genBusy} className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-[12px] font-semibold text-white shadow-brand hover:bg-brand-700 disabled:opacity-60">
                          {genBusy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Let the agent draft them
                        </button>
                      </div>
                    ) : steps.map((s) => (
                      s.kind === 'wait' ? (
                        <div key={s.id} className="flex items-center gap-2 py-1 pl-3">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-2 text-ink-subtle">{stepIcon.wait}</span>
                          <span className="text-[11.5px] font-medium text-ink-muted">{s.title}</span>
                          <span className="ml-2 h-px flex-1 bg-line" />
                        </div>
                      ) : (
                        <div key={s.id} className="rounded-xl border border-line bg-surface p-3 shadow-xs">
                          <div className="flex items-start gap-2">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">{stepIcon[s.kind]}</span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[12.5px] font-bold text-ink">{s.title}</p>
                              <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-4 text-ink-muted">{s.goal}</p>
                            </div>
                            <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-700 ring-1 ring-inset ring-brand-100"><Sparkles size={10} /> AI</span>
                          </div>
                          <div className="mt-2 flex items-center justify-between border-t border-line pt-2 text-[10.5px] text-ink-subtle">
                            <span className="inline-flex items-center gap-1"><Clock3 size={10} /> {s.schedule}</span>
                            <span className="font-medium text-ink-muted">{s.channel}</span>
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                </div>

                {/* recipients rail */}
                <aside className="hidden w-[320px] shrink-0 flex-col overflow-y-auto border-l border-line bg-surface/60 xl:flex">
                  <header className="flex items-center justify-between border-b border-line px-4 py-3">
                    <h3 className="inline-flex items-center gap-1.5 text-[13px] font-bold text-ink"><Users size={14} className="text-brand-600" /> Recipients</h3>
                    <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[11px] font-bold text-ink-muted">{recipients.length}</span>
                  </header>
                  <div className="flex-1 space-y-1.5 p-3">
                    {recipients.length === 0 ? (
                      <p className="px-1 py-4 text-center text-[12px] text-ink-muted">No recipients yet. Enroll leads from Data Hub → “Add to campaign”.</p>
                    ) : recipients.map((cl) => (
                      <div key={cl.id} className="flex items-center gap-2.5 rounded-lg border border-line bg-surface px-2.5 py-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] text-[10px] font-bold text-white">{(cl.lead.firstName?.[0] ?? '') + (cl.lead.lastName?.[0] ?? '')}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-semibold text-ink">{cl.lead.firstName} {cl.lead.lastName}</p>
                          <p className="truncate text-[10.5px] text-ink-subtle">{cl.lead.company ?? cl.lead.email ?? '—'}</p>
                        </div>
                        {cl.status && <span className="shrink-0 rounded-full bg-surface-2 px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-ink-subtle">{cl.status}</span>}
                      </div>
                    ))}
                  </div>
                </aside>
              </div>
            </>
          )}
        </section>
      </div>

      <AnimatePresence>
        {showCreate && (
          <CreateCampaignModal onClose={() => setShowCreate(false)} onCreated={(id) => { setSelectedId(id); void loadList(); }} />
        )}
      </AnimatePresence>

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[12.5px] font-semibold text-ink shadow-lg">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-600 text-white"><Send size={12} /></span>
          {toast}
        </div>
      )}
    </>
  );
}

function Brief({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start gap-1.5">
      <span className="mt-0.5 shrink-0 text-ink-subtle">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-ink-subtle">{label}</p>
        <p className="line-clamp-2 text-[11.5px] font-medium leading-4 text-ink" title={value}>{value}</p>
      </div>
    </div>
  );
}
