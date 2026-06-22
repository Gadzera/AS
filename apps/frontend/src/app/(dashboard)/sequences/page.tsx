'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { campaignsApi, sequencesApi, type SequenceOverview } from '@/lib/api';
import type { Campaign, Sequence } from '@/types';
import Topbar from '@/components/layout/Topbar';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import {
  Workflow,
  Mail,
  Linkedin,
  Clock,
  Gauge,
  Flame,
  Send,
  Mailbox,
  CalendarRange,
  Sparkles,
  Plus,
  Pencil,
  Trash2,
  Play,
  Pause,
  Users,
  ArrowRight,
  Loader2,
  ChevronRight,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

/* ──────────────────────────────────────────────────────────────────────────
   Sequences (/sequences) — движок исходящего. Последовательность = упорядоченные
   шаги (канал/задержка/тема/тело) одной кампании; их исполняет воркер-планировщик
   с учётом дневного лимита, прогрева, окна отправки (из Workspace) и привязанного
   ящика. Всё на ЖИВЫХ данных: GET /sequences/:id/overview, CRUD шагов, AI-генерация.
   Светлая Bold-тема.
   ────────────────────────────────────────────────────────────────────────── */

const STATUS_TONE: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700', DRAFT: 'bg-surface-2 text-ink-muted',
  PAUSED: 'bg-amber-100 text-amber-700', COMPLETED: 'bg-brand-100 text-brand-700',
};
const LEAD_STATUS_TONE: Record<string, string> = {
  NEW: 'bg-surface-2 text-ink-muted', CONTACTED: 'bg-sky-100 text-sky-700', REPLIED: 'bg-violet-100 text-violet-700',
  INTERESTED: 'bg-emerald-100 text-emerald-700', HOT: 'bg-rose-100 text-rose-700', CONVERTED: 'bg-brand-100 text-brand-700',
  LOST: 'bg-surface-2 text-ink-subtle', UNSUBSCRIBED: 'bg-surface-2 text-ink-subtle', QUALIFIED: 'bg-emerald-100 text-emerald-700',
  // M11-2: EnrollmentStatus (статусы enrollment'а в воронке последовательности)
  PENDING: 'bg-surface-2 text-ink-muted', ACTIVE: 'bg-sky-100 text-sky-700', PAUSED: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-brand-100 text-brand-700', STOPPED: 'bg-surface-2 text-ink-subtle',
};

function ChannelIcon({ channel, size = 14 }: { channel: string; size?: number }) {
  return channel === 'LINKEDIN' ? <Linkedin size={size} /> : <Mail size={size} />;
}

export default function SequencesPage() {
  const router = useRouter();
  const toast = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [overview, setOverview] = useState<SequenceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingOv, setLoadingOv] = useState(false);
  const [genBy, setGenBy] = useState('');

  const [stepModal, setStepModal] = useState<{ mode: 'add' | 'edit'; step?: Sequence } | null>(null);
  const [genOpen, setGenOpen] = useState(false);

  useEffect(() => {
    campaignsApi.list().then((list) => {
      setCampaigns(list);
      if (list.length) setSelectedId((prev) => prev ?? list[0].id);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  function loadOverview(id: string) {
    setLoadingOv(true);
    sequencesApi.overview(id).then(setOverview).catch(() => setOverview(null)).finally(() => setLoadingOv(false));
  }
  useEffect(() => { if (selectedId) loadOverview(selectedId); }, [selectedId]);

  const selected = campaigns.find((c) => c.id === selectedId) ?? null;
  const steps = overview?.steps ?? [];

  // Кумулятивный день для каждого шага (по сумме delayDays)
  const cumulativeDays = useMemo(() => {
    let acc = 0; return steps.map((s) => { acc += s.delayDays; return acc; });
  }, [steps]);

  async function deleteStep(step: Sequence) {
    if (!window.confirm(`Delete step ${step.stepNumber}? This removes it from the sequence.`)) return;
    try { await sequencesApi.delete(step.id); if (selectedId) loadOverview(selectedId); toast.success('Step removed'); }
    catch { toast.error('Could not delete step'); }
  }

  const [reordering, setReordering] = useState(false);
  // M11-9: переместить шаг вверх/вниз. Активные enrolled лиды мигрируются по идентичности (бэкенд),
  // тост сообщает, скольких затронуло — изменение прозрачно, не молчаливо.
  async function moveStep(idx: number, dir: -1 | 1) {
    if (!selectedId) return;
    const target = idx + dir;
    if (target < 0 || target >= steps.length) return;
    const orderedIds = steps.map((s) => s.id);
    [orderedIds[idx], orderedIds[target]] = [orderedIds[target], orderedIds[idx]];
    setReordering(true);
    try {
      const r = await sequencesApi.reorder(selectedId, orderedIds);
      loadOverview(selectedId);
      toast.success(`Steps reordered${r.migratedEnrollments ? ` · ${r.migratedEnrollments} active lead${r.migratedEnrollments === 1 ? '' : 's'} kept on the same step` : ''}`);
    } catch { toast.error('Could not reorder steps'); }
    finally { setReordering(false); }
  }

  return (
    <>
      <Topbar title="Sequences" subtitle="Outbound motion · the sending engine" icon={<Workflow size={18} strokeWidth={1.85} />} />

      <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-line bg-surface/70 px-4">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-muted"><Send size={13} className="text-brand-600" /> {campaigns.length} sequence(s) · executed by the scheduler</span>
        {genBy && <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700 ring-1 ring-inset ring-brand-100"><Sparkles size={11} /> {genBy === 'demo' ? 'grounded demo' : genBy}</span>}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* rail */}
        <aside className="hidden w-[260px] shrink-0 flex-col overflow-y-auto border-r border-line bg-surface/50 p-2.5 md:flex">
          <p className="px-2 pb-1 pt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-subtle">Sequences</p>
          {loading ? [...Array(4)].map((_, i) => <div key={i} className="skeleton mb-1.5 h-16 rounded-xl" />) : campaigns.length === 0 ? (
            <div className="px-2 py-8 text-center">
              <p className="text-[12.5px] text-ink-muted">No campaigns yet.</p>
              <Button size="sm" variant="secondary" className="mt-2" onClick={() => router.push('/campaigns')}>Create in Outreach Studio</Button>
            </div>
          ) : campaigns.map((c) => {
            const active = c.id === selectedId;
            return (
              <button key={c.id} type="button" onClick={() => setSelectedId(c.id)}
                className={['mb-1.5 w-full rounded-xl border px-3 py-2.5 text-left transition-colors', active ? 'border-brand-200 bg-brand-50/60 ring-1 ring-inset ring-brand-100' : 'border-line bg-surface hover:bg-surface-2'].join(' ')}>
                <div className="flex items-center gap-1.5">
                  <span className="text-brand-600"><ChannelIcon channel={c.channel} size={13} /></span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{c.name}</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[9.5px] font-bold ${STATUS_TONE[c.status] ?? 'bg-surface-2 text-ink-muted'}`}>{c.status}</span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-subtle">
                  <span>{c._count?.sequences ?? 0} steps</span>
                  <span>·</span>
                  <span>{c._count?.campaignLeads ?? 0} enrolled</span>
                </div>
              </button>
            );
          })}
        </aside>

        {/* center */}
        <main className="min-h-0 flex-1 overflow-y-auto p-4">
          {!selected ? (
            <div className="flex h-full items-center justify-center text-[13px] text-ink-subtle">Select a sequence to view its structure.</div>
          ) : (
            <div className="mx-auto max-w-4xl space-y-4">
              {/* header */}
              <div className="flex items-center gap-2">
                <h2 className="text-[17px] font-extrabold tracking-[-0.01em] text-ink">{selected.name}</h2>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_TONE[selected.status] ?? 'bg-surface-2 text-ink-muted'}`}>{selected.status}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-ink-muted"><ChannelIcon channel={selected.channel} size={11} /> {selected.channel}</span>
                <div className="ml-auto flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setGenOpen(true)}><Sparkles size={14} /> AI generate</Button>
                  <Button size="sm" variant="primary" onClick={() => setStepModal({ mode: 'add' })}><Plus size={14} strokeWidth={2.2} /> Add step</Button>
                </div>
              </div>

              {/* engine bar */}
              {overview && (
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
                  <EngineCard icon={<Gauge size={13} />} label="Daily limit" value={`${overview.engine.effectiveLimit}/${overview.engine.dailyLimit}`} sub={overview.engine.warmupActive ? 'warm-up' : 'full speed'} tone={overview.engine.warmupActive ? 'amber' : 'emerald'} />
                  <EngineCard icon={<Flame size={13} />} label="Warm-up" value={overview.engine.warmupStage.split(' · ')[0]} sub={overview.engine.warmupStage.includes('·') ? overview.engine.warmupStage.split('· ')[1] : ''} />
                  <EngineCard icon={<Send size={13} />} label="Sent today" value={`${overview.engine.sentToday}`} sub={`${overview.engine.remainingToday} left`} />
                  <EngineCard icon={<CalendarRange size={13} />} label="Window" value={overview.engine.window ? `${overview.engine.window.start}–${overview.engine.window.end}` : '—'} sub={overview.engine.window ? `${overview.engine.window.days.length}d · ${overview.engine.window.timezone.split('/')[1] ?? overview.engine.window.timezone}` : 'set in Workspace'} />
                  <EngineCard icon={<Mailbox size={13} />} label="Mailbox" value={overview.engine.mailbox ? (overview.engine.mailbox.address.split('@')[0]) : 'none'} sub={overview.engine.mailbox ? overview.engine.mailbox.status.toLowerCase() : 'connect one'} tone={overview.engine.mailbox?.status === 'CONNECTED' ? 'emerald' : 'amber'} />
                  <EngineCard icon={overview.engine.schedulerActive ? <Play size={13} /> : <Pause size={13} />} label="Scheduler" value={overview.engine.schedulerActive ? 'Running' : 'Paused'} sub={overview.engine.schedulerActive ? `${overview.enrollment.dueNow} due now` : 'campaign not active'} tone={overview.engine.schedulerActive ? 'emerald' : 'muted'} />
                </div>
              )}

              {/* steps timeline */}
              <div className="rounded-xl border border-line bg-surface p-4 shadow-xs">
                <div className="mb-3 flex items-center gap-2">
                  <Workflow size={14} className="text-brand-600" />
                  <h3 className="text-[12.5px] font-bold text-ink">Sequence steps</h3>
                  <span className="text-[11px] text-ink-subtle">— each step is sent after its delay, in order, within the window</span>
                </div>

                {loadingOv ? (
                  <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-20 rounded-lg" />)}</div>
                ) : steps.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-line py-10 text-center">
                    <Workflow size={20} className="mx-auto mb-2 text-ink-subtle" />
                    <p className="text-[13px] font-semibold text-ink">No steps yet</p>
                    <p className="mt-0.5 text-[12px] text-ink-muted">Let the agent author the sequence, or add the first step manually.</p>
                    <div className="mt-3 flex items-center justify-center gap-2">
                      <Button size="sm" variant="primary" onClick={() => setGenOpen(true)}><Sparkles size={14} /> AI generate</Button>
                      <Button size="sm" variant="secondary" onClick={() => setStepModal({ mode: 'add' })}><Plus size={14} /> Add step</Button>
                    </div>
                  </div>
                ) : (
                  <ol className="relative space-y-2.5 pl-1">
                    {steps.map((s, idx) => {
                      const atStep = overview?.enrollment.byStep.find((b) => b.stepNumber === s.stepNumber)?.atStep ?? 0;
                      return (
                        <li key={s.id} className="relative flex gap-3">
                          <div className="flex flex-col items-center">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white">{s.stepNumber}</span>
                            {idx < steps.length - 1 && <span className="my-0.5 w-px flex-1 bg-line" />}
                          </div>
                          <div className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2/30 p-3">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 rounded-md bg-surface px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-muted ring-1 ring-inset ring-line"><ChannelIcon channel={s.channel} size={10} /> {s.channel}</span>
                              <span className="inline-flex items-center gap-1 rounded-md bg-surface px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-muted ring-1 ring-inset ring-line"><Clock size={10} /> {s.delayDays === 0 ? 'immediately' : `+${s.delayDays}d`} · day {cumulativeDays[idx]}</span>
                              {atStep > 0 && <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-1.5 py-0.5 text-[10.5px] font-bold text-brand-700"><Users size={10} /> {atStep} here</span>}
                              <div className="ml-auto flex items-center gap-1">
                                <button type="button" title="Move up" disabled={idx === 0 || reordering} onClick={() => moveStep(idx, -1)} className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-subtle hover:bg-surface hover:text-brand-600 disabled:opacity-30 disabled:hover:bg-transparent"><ChevronUp size={14} /></button>
                                <button type="button" title="Move down" disabled={idx === steps.length - 1 || reordering} onClick={() => moveStep(idx, 1)} className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-subtle hover:bg-surface hover:text-brand-600 disabled:opacity-30 disabled:hover:bg-transparent"><ChevronDown size={14} /></button>
                                <button type="button" title="Edit step" onClick={() => setStepModal({ mode: 'edit', step: s })} className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-subtle hover:bg-surface hover:text-brand-600"><Pencil size={13} /></button>
                                <button type="button" title="Delete step" onClick={() => deleteStep(s)} className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-subtle hover:bg-rose-50 hover:text-rose-600"><Trash2 size={13} /></button>
                              </div>
                            </div>
                            {s.subject && <p className="mt-1.5 text-[12.5px] font-bold text-ink">{s.subject}</p>}
                            <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-[12px] leading-4 text-ink-muted">{s.body || (s.subject ? '' : 'AI writes this at send time.')}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>

              {/* enrollment funnel */}
              {overview && overview.enrollment.total > 0 && (
                <div className="rounded-xl border border-line bg-surface p-4 shadow-xs">
                  <div className="mb-3 flex items-center gap-2">
                    <Users size={14} className="text-brand-600" />
                    <h3 className="text-[12.5px] font-bold text-ink">Enrollment</h3>
                    <span className="text-[11px] text-ink-subtle">— {overview.enrollment.total} leads in this sequence</span>
                  </div>
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {Object.entries(overview.enrollment.byStatus).sort((a, b) => b[1] - a[1]).map(([st, n]) => (
                      <span key={st} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${LEAD_STATUS_TONE[st] ?? 'bg-surface-2 text-ink-muted'}`}>{st.toLowerCase()} · {n}</span>
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    {overview.enrollment.byStep.map((b, idx) => {
                      const pct = overview.enrollment.total ? Math.round((b.atStep / overview.enrollment.total) * 100) : 0;
                      return (
                        <div key={b.stepNumber} className="flex items-center gap-2">
                          <span className="w-12 shrink-0 text-[11px] font-semibold text-ink-subtle">Step {b.stepNumber}</span>
                          <div className="h-4 flex-1 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-brand-500/80" style={{ width: `${pct}%` }} /></div>
                          <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-ink-muted">{b.atStep} ({pct}%)</span>
                          {idx < 0 && null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* note */}
              <p className="flex items-center gap-1.5 text-[11.5px] text-ink-subtle">
                <Loader2 size={13} className="text-brand-500" />
                Steps are executed by the background scheduler with per-campaign daily limits, automatic warm-up, the workspace sending window and the connected mailbox. Email delivery is in demo mode until SMTP/OAuth is connected.
              </p>
            </div>
          )}
        </main>
      </div>

      {selected && stepModal && (
        <StepModal mode={stepModal.mode} step={stepModal.step} campaignId={selected.id} channel={selected.channel}
          nextStepNumber={(steps[steps.length - 1]?.stepNumber ?? 0) + 1}
          onClose={() => setStepModal(null)} onDone={() => { setStepModal(null); if (selectedId) loadOverview(selectedId); }} />
      )}
      {selected && genOpen && (
        <GenerateModal campaignId={selected.id} hasSteps={steps.length > 0}
          onClose={() => setGenOpen(false)} onDone={(by) => { setGenOpen(false); setGenBy(by); if (selectedId) loadOverview(selectedId); }} />
      )}
    </>
  );
}

function EngineCard({ icon, label, value, sub, tone = 'default' }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: 'default' | 'emerald' | 'amber' | 'muted' }) {
  const subTone = tone === 'emerald' ? 'text-emerald-600' : tone === 'amber' ? 'text-amber-600' : 'text-ink-subtle';
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2.5 shadow-xs">
      <span className="mb-0.5 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.05em] text-ink-subtle">{icon} {label}</span>
      <p className="truncate text-[15px] font-extrabold leading-tight tracking-[-0.01em] text-ink">{value}</p>
      {sub && <p className={`truncate text-[10.5px] font-medium ${subTone}`}>{sub}</p>}
    </div>
  );
}

/* ══════════════════ Step add/edit ══════════════════ */
function StepModal({ mode, step, campaignId, channel, nextStepNumber, onClose, onDone }: {
  mode: 'add' | 'edit'; step?: Sequence; campaignId: string; channel: string; nextStepNumber: number; onClose: () => void; onDone: () => void;
}) {
  const toast = useToast();
  const [ch, setCh] = useState<string>(step?.channel ?? channel ?? 'EMAIL');
  const [delayDays, setDelayDays] = useState<number>(step?.delayDays ?? (mode === 'add' && nextStepNumber === 1 ? 0 : 3));
  const [subject, setSubject] = useState(step?.subject ?? '');
  const [body, setBody] = useState(step?.body ?? '');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');

  async function submit() {
    setErr('');
    if (!body.trim()) { setErr('Body is required (use AI generate for the whole sequence, or write it here).'); return; }
    setBusy(true);
    try {
      if (mode === 'edit' && step) {
        await sequencesApi.update(step.id, { channel: ch as Sequence['channel'], delayDays, subject: subject || null, body });
        toast.success('Step updated');
      } else {
        await sequencesApi.create(campaignId, { stepNumber: nextStepNumber, delayDays, subject: subject || undefined, body, channel: ch });
        toast.success('Step added');
      }
      onDone();
    } catch (e) {
      const error = e as { response?: { data?: { error?: string } } };
      setErr(error.response?.data?.error || 'Could not save step.');
    } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title={mode === 'edit' ? `Edit step ${step?.stepNumber}` : 'Add step'} size="lg"
      footer={<><Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button><Button variant="primary" size="sm" loading={busy} disabled={!body.trim()} onClick={submit}>{mode === 'edit' ? 'Save step' : 'Add step'}</Button></>}>
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium text-ink-muted">Channel</label>
            <select value={ch} onChange={(e) => setCh(e.target.value)} className="h-10 rounded-lg border border-[var(--border-strong)] bg-white px-3 text-[14px] text-ink focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100">
              <option value="EMAIL">Email</option><option value="LINKEDIN">LinkedIn</option>
            </select>
          </div>
          <Input label="Delay (days before this step)" type="number" min={0} max={60} value={delayDays} onChange={(e) => setDelayDays(Math.max(0, Number(e.target.value) || 0))} hint="0 = sent immediately when the lead reaches this step" />
        </div>
        {ch === 'EMAIL' && <Input label="Subject (optional)" placeholder="Quick question about {{company}}" value={subject} onChange={(e) => setSubject(e.target.value)} />}
        <div className="flex flex-col gap-1">
          <label className="text-[12px] font-medium text-ink-muted">Body</label>
          <textarea rows={9} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write the message. Leave personalization to the agent or use {{firstName}}, {{company}} tokens."
            className="w-full rounded-lg border border-[var(--border-strong)] bg-white p-3 text-[13px] leading-5 text-ink focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100" />
          {err && <p className="text-[12px] text-rose-600">{err}</p>}
        </div>
      </div>
    </Modal>
  );
}

/* ══════════════════ AI generate ══════════════════ */
function GenerateModal({ campaignId, hasSteps, onClose, onDone }: { campaignId: string; hasSteps: boolean; onClose: () => void; onDone: (by: string) => void }) {
  const toast = useToast();
  const [steps, setSteps] = useState(4);
  const [language, setLanguage] = useState<'en' | 'ru' | 'de'>('en');
  const [tone, setTone] = useState<'professional' | 'casual' | 'friendly'>('professional');
  const [valueProposition, setValueProposition] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');

  async function submit() {
    setErr(''); setBusy(true);
    try {
      const r = await sequencesApi.generate(campaignId, { steps, language, tone, valueProposition: valueProposition || undefined, replace: hasSteps });
      toast.success('Sequence generated', `${r.sequences.length} steps · ${r.generatedBy}`);
      onDone(r.generatedBy);
    } catch (e) {
      const error = e as { response?: { data?: { error?: string } } };
      setErr(error.response?.data?.error || 'Generation failed.');
    } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title="AI generate sequence" size="md"
      footer={<><Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button><Button variant="primary" size="sm" loading={busy} onClick={submit}><Sparkles size={14} /> {hasSteps ? 'Regenerate' : 'Generate'}</Button></>}>
      <div className="space-y-3 p-4">
        {hasSteps && <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-[12px] text-amber-800"><Flame size={13} className="mt-0.5 shrink-0 text-amber-600" /> This sequence already has steps — generating will replace them.</div>}
        <div className="grid grid-cols-3 gap-3">
          <Input label="Steps" type="number" min={1} max={6} value={steps} onChange={(e) => setSteps(Math.min(6, Math.max(1, Number(e.target.value) || 1)))} />
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium text-ink-muted">Language</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value as typeof language)} className="h-10 rounded-lg border border-[var(--border-strong)] bg-white px-3 text-[14px] text-ink focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100">
              <option value="en">English</option><option value="ru">Russian</option><option value="de">German</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium text-ink-muted">Tone</label>
            <select value={tone} onChange={(e) => setTone(e.target.value as typeof tone)} className="h-10 rounded-lg border border-[var(--border-strong)] bg-white px-3 text-[14px] text-ink focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100">
              <option value="professional">Professional</option><option value="casual">Casual</option><option value="friendly">Friendly</option>
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[12px] font-medium text-ink-muted">Value proposition (optional)</label>
          <textarea rows={3} value={valueProposition} onChange={(e) => setValueProposition(e.target.value)} placeholder="We help SaaS teams 3x reply rates with autonomous AI-SDR…"
            className="w-full rounded-lg border border-[var(--border-strong)] bg-white p-3 text-[13px] leading-5 text-ink focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100" />
        </div>
        {err && <p className="text-[12px] text-rose-600">{err}</p>}
        <p className="flex items-center gap-1.5 text-[11.5px] text-ink-subtle"><Sparkles size={12} className="text-brand-500" /> The agent writes steps from the campaign targeting via DeepSeek (grounded demo without a key).</p>
      </div>
    </Modal>
  );
}
