'use client';

import { useEffect, useMemo, useState } from 'react';
import { workflowsApi, type Workflow, type WorkflowRunItem, type WorkflowCatalog, type WorkflowTrigger, type WorkflowConditionClass, type WorkflowInput, type WorkflowRunDetail, type WorkflowRunStatus, type WorkflowActionParam } from '@/lib/api';
import Topbar from '@/components/layout/Topbar';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import {
  Zap,
  Plus,
  Pencil,
  Trash2,
  Lock,
  MessageSquareReply,
  CalendarCheck,
  Flag,
  UserX,
  ArrowRight,
  Activity,
  Bell,
  Pause,
  Flame,
  CheckCircle2,
  Ban,
  Reply,
  History,
  Power,
  Play,
  MailOpen,
  MailX,
  Clock,
  RotateCcw,
  RefreshCw,
  X,
  Loader2,
  AlertTriangle,
  ChevronRight,
  FilePlus,
  FilePen,
  MousePointerClick,
  ListPlus,
  ListChecks,
  CheckSquare,
  Webhook,
  FileText,
  Send,
  Search,
  Archive,
  ListMinus,
  Filter,
  GitBranch,
  Split,
  Users,
  ArrowUp,
  ArrowDown,
  Timer,
  Sparkles,
  Globe,
  Wand2,
  UserPlus,
  UserMinus,
  KeyRound,
  UploadCloud,
  Copy,
} from 'lucide-react';

/* ──────────────────────────────────────────────────────────────────────────
   Workflows (/workflows) — правила автоматизации поверх sequence-движка:
   ТРИГГЕР → УСЛОВИЕ → ДЕЙСТВИЯ. Исполняются РЕАЛЬНО (триаж ответов, бронь встреч):
   GET/POST/PATCH/DELETE /api/workflows; лента прогонов из WorkflowRun. Светлая Bold-тема.
   ────────────────────────────────────────────────────────────────────────── */

const TRIGGER_ICON: Partial<Record<WorkflowTrigger, React.ReactNode>> = {
  REPLY_RECEIVED: <MessageSquareReply size={14} />, MEETING_BOOKED: <CalendarCheck size={14} />,
  SEQUENCE_COMPLETED: <Flag size={14} />, LEAD_UNSUBSCRIBED: <UserX size={14} />,
  OPENED: <MailOpen size={14} />, BOUNCED: <MailX size={14} />,
  // M17-2 канонические CRM-триггеры
  RECORD_CREATED: <FilePlus size={14} />, RECORD_UPDATED: <FilePen size={14} />, ATTRIBUTE_UPDATED: <Pencil size={14} />,
  RECORD_COMMAND: <MousePointerClick size={14} />, MANUAL_RUN: <Play size={14} />, RECORD_ADDED_TO_LIST: <ListPlus size={14} />,
  LIST_ENTRY_COMMAND: <MousePointerClick size={14} />, LIST_ENTRY_UPDATED: <ListChecks size={14} />, TASK_CREATED: <CheckSquare size={14} />,
  RECURRING_SCHEDULE: <Clock size={14} />, WEBHOOK_RECEIVED: <Webhook size={14} />, TYPEFORM_SUBMISSION: <FileText size={14} />, OUTREACH_EVENT: <Send size={14} />,
};
const triggerIcon = (t: WorkflowTrigger): React.ReactNode => TRIGGER_ICON[t] ?? <Zap size={14} />;
const ACTION_ICON: Record<string, React.ReactNode> = {
  NOTIFY_HUMAN: <Bell size={11} />, PAUSE_SEQUENCE: <Pause size={11} />, SET_LEAD_HOT: <Flame size={11} />,
  MARK_CONVERTED: <CheckCircle2 size={11} />, SUPPRESS_CONTACT: <Ban size={11} />, MOVE_TO_REPLIED: <Reply size={11} />,
  // M17-3 типизированные действия
  CREATE_RECORD: <FilePlus size={11} />, UPDATE_RECORD: <FilePen size={11} />, FIND_RECORDS: <Search size={11} />, ARCHIVE_RECORD: <Archive size={11} />,
  ADD_TO_LIST: <ListPlus size={11} />, REMOVE_FROM_LIST: <ListMinus size={11} />, UPDATE_LIST_ENTRY: <ListChecks size={11} />,
  FILTER: <Filter size={11} />, IF: <GitBranch size={11} />, SWITCH: <Split size={11} />,
  DELAY: <Timer size={11} />, DELAY_UNTIL: <Clock size={11} />, ROUND_ROBIN: <Users size={11} />,
  // M17-4
  AI_CLASSIFY: <Sparkles size={11} />, AI_SUMMARIZE: <Sparkles size={11} />, AI_PROMPT: <Sparkles size={11} />, AI_RESEARCH: <Sparkles size={11} />,
  HTTP_REQUEST: <Globe size={11} />, TRANSFORM: <Wand2 size={11} />,
  ENROLL_SEQUENCE: <UserPlus size={11} />, UNENROLL_SEQUENCE: <UserMinus size={11} />, SEND_NOTIFICATION: <Send size={11} />,
};

// M17-3: элемент actions[] — голый ключ ИЛИ JSON-спека {type,config}. Разбор для отрисовки/билдера.
function parseSpec(a: string): { type: string; config: Record<string, unknown> } {
  const s = (a ?? '').trim();
  if (s.startsWith('{')) {
    try { const o = JSON.parse(s) as { type?: unknown; config?: unknown }; if (o && typeof o.type === 'string') return { type: o.type, config: (o.config && typeof o.config === 'object' ? o.config : {}) as Record<string, unknown> }; } catch { /* fall through */ }
  }
  return { type: s, config: {} };
}
const CLASS_LABEL: Record<string, string> = { INTERESTED: 'Interested', NOT_INTERESTED: 'Not interested', FOLLOW_UP: 'Follow-up', UNSUBSCRIBE: 'Unsubscribe' };

// M17-1: цвет/метка статуса прогона (и шага). Источник истины — backend WorkflowRun.status.
const STATUS_META: Record<string, { label: string; cls: string }> = {
  SUCCEEDED: { label: 'Succeeded', cls: 'bg-emerald-100 text-emerald-700' },
  PARTIAL: { label: 'Partial', cls: 'bg-amber-100 text-amber-700' },
  FAILED: { label: 'Failed', cls: 'bg-rose-100 text-rose-700' },
  RUNNING: { label: 'Running', cls: 'bg-brand-100 text-brand-700' },
  WAITING: { label: 'Waiting', cls: 'bg-sky-100 text-sky-700' },
  PENDING: { label: 'Pending', cls: 'bg-surface-2 text-ink-subtle' },
  SKIPPED: { label: 'Skipped', cls: 'bg-violet-100 text-violet-700' },
};
function StatusPill({ status, size = 'sm' }: { status: string; size?: 'sm' | 'xs' }) {
  const m = STATUS_META[status] ?? { label: status, cls: 'bg-surface-2 text-ink-subtle' };
  return <span className={`inline-flex items-center rounded-full font-bold ${m.cls} ${size === 'xs' ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'}`}>{m.label}</span>;
}
function fmtDuration(ms: number | null | undefined): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)}s`;
}
const RUN_FILTERS: (WorkflowRunStatus | 'ALL')[] = ['ALL', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'SKIPPED'];

function timeAgo(iso: string): string {
  const diff = (new Date().getTime() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function WorkflowsPage() {
  const toast = useToast();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [runs, setRuns] = useState<WorkflowRunItem[]>([]);
  const [catalog, setCatalog] = useState<WorkflowCatalog | null>(null);
  const [stats, setStats] = useState<{ total: number; active: number; totalRuns: number } | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Workflow | 'new' | null>(null);
  const [secretsOpen, setSecretsOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  // M17-1: Runs-ledger drill-in
  const [runFilter, setRunFilter] = useState<WorkflowRunStatus | 'ALL'>('ALL');
  const [openRunId, setOpenRunId] = useState<string | null>(null);
  const [detail, setDetail] = useState<WorkflowRunDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  function reload() {
    workflowsApi.list().then((r) => {
      setWorkflows(r.workflows); setRuns(r.runs); setCatalog(r.catalog); setStats(r.stats); setCanManage(r.canManage);
    }).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(() => { reload(); }, []);

  const filteredRuns = useMemo(() => runFilter === 'ALL' ? runs : runs.filter((r) => r.status === runFilter), [runs, runFilter]);

  function openRun(id: string) {
    setOpenRunId(id); setDetail(null); setDetailLoading(true);
    workflowsApi.runDetail(id).then(setDetail).catch(() => {}).finally(() => setDetailLoading(false));
  }
  function refreshDetail() { if (openRunId) workflowsApi.runDetail(openRunId).then(setDetail).catch(() => {}); }
  async function retryRun() {
    if (!detail) return;
    setDetailLoading(true);
    try { const r = await workflowsApi.retryRun(detail.run.id); toast.success('Run retried', `Status: ${r.status}`); refreshDetail(); reload(); }
    catch (e) { const err = e as { response?: { data?: { error?: string } } }; toast.error('Retry failed', err.response?.data?.error || 'Try again.'); }
    finally { setDetailLoading(false); }
  }
  async function rerunRun() {
    if (!detail) return;
    setDetailLoading(true);
    try { const r = await workflowsApi.rerun(detail.run.id); toast.success('Re-ran workflow', `New run: ${r.status}`); reload(); if (r.runId) openRun(r.runId); }
    catch { toast.error('Re-run failed', 'Try again.'); }
    finally { setDetailLoading(false); }
  }

  async function toggle(w: Workflow) {
    setBusyId(w.id);
    try { await workflowsApi.update(w.id, { isActive: !w.isActive }); reload(); toast.success(w.isActive ? 'Workflow paused' : 'Workflow enabled', w.name); }
    catch { toast.error('Could not update', w.name); } finally { setBusyId(null); }
  }
  async function remove(w: Workflow) {
    if (!window.confirm(`Delete workflow "${w.name}"?`)) return;
    setBusyId(w.id);
    try { await workflowsApi.remove(w.id); reload(); toast.success('Workflow deleted', w.name); }
    catch (e) { const err = e as { response?: { data?: { error?: string } } }; toast.error('Could not delete', err.response?.data?.error || w.name); } finally { setBusyId(null); }
  }
  // dry-run: симуляция без мутаций + наблюдаемый [test]-прогон в ленте
  async function test(w: Workflow) {
    setBusyId(w.id);
    try {
      const r = await workflowsApi.test(w.id);
      reload();
      toast.success(`Test run · ${w.name}`, r.lead ? `${r.lead} — would: ${r.parts.join(' · ')}` : `would: ${r.parts.join(' · ')}`);
    } catch { toast.error('Could not run test', w.name); } finally { setBusyId(null); }
  }
  // M17-2: ручной запуск правила (РЕАЛЬНЫЕ мутации). clientRequestId защищает от двойного клика; дубль → existing run.
  async function runNow(w: Workflow) {
    setBusyId(w.id);
    try {
      const r = await workflowsApi.runManual(w.id, { clientRequestId: crypto.randomUUID() });
      reload();
      if (r.runId) openRun(r.runId);
      toast.success(r.deduped ? 'Already run (deduped)' : `Ran · ${w.name}`, `Status: ${r.status ?? '—'}`);
    } catch (e) { const err = e as { response?: { data?: { error?: string } } }; toast.error('Could not run', err.response?.data?.error || w.name); } finally { setBusyId(null); }
  }
  // M17-5: публикация draft → новая версия. Валидация не прошла → field-level ошибки (422).
  async function publish(w: Workflow) {
    setBusyId(w.id);
    try { const r = await workflowsApi.publish(w.id); reload(); toast.success(`Published v${r.version}`, w.name); }
    catch (e) {
      const err = e as { response?: { data?: { errors?: { field: string; message: string }[]; error?: string } } };
      const errs = err.response?.data?.errors;
      toast.error('Publish blocked', errs?.length ? errs.map((x) => `${x.field}: ${x.message}`).slice(0, 3).join(' · ') : err.response?.data?.error || 'Could not publish.');
    } finally { setBusyId(null); }
  }
  async function dup(w: Workflow) {
    setBusyId(w.id);
    try { await workflowsApi.duplicate(w.id); reload(); toast.success('Duplicated as draft', `${w.name} (copy)`); }
    catch { toast.error('Could not duplicate', w.name); } finally { setBusyId(null); }
  }

  return (
    <>
      <Topbar title="Workflows" subtitle="Outbound motion · automation rules" icon={<Zap size={18} strokeWidth={1.85} />} />

      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-surface/70 px-4">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-muted"><Zap size={13} className="text-brand-600" /> {stats?.total ?? 0} rule(s) · {stats?.active ?? 0} active</span>
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-muted"><Activity size={13} className="text-emerald-600" /> {stats?.totalRuns ?? 0} total runs</span>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setSecretsOpen(true)}><KeyRound size={14} /> Secrets</Button>
          {canManage && <Button size="sm" variant="primary" onClick={() => setEditing('new')}><Plus size={14} strokeWidth={2.2} /> New workflow</Button>}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* rules */}
        <main className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="mx-auto max-w-3xl space-y-3">
            {loading ? [...Array(4)].map((_, i) => <div key={i} className="skeleton h-28 rounded-xl" />) : workflows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line py-12 text-center">
                <Zap size={22} className="mx-auto mb-2 text-ink-subtle" />
                <p className="text-[13px] font-semibold text-ink">No workflows yet</p>
                <p className="mt-0.5 text-[12px] text-ink-muted">Create a rule to automate what happens on replies and meetings.</p>
              </div>
            ) : workflows.map((w) => (
              <div key={w.id} className={['rounded-xl border bg-surface p-4 shadow-xs transition-colors', w.isActive ? 'border-line' : 'border-line bg-surface-2/30 opacity-75'].join(' ')}>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[14px] font-bold text-ink">{w.name}</h3>
                      {w.isSystem && <span className="inline-flex items-center gap-0.5 rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold text-ink-subtle"><Lock size={9} /> System</span>}
                      <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${w.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-2 text-ink-subtle'}`}>{w.isActive ? 'Active' : 'Paused'}</span>
                      {/* M17-5: draft/published lifecycle */}
                      {w.published ? <span className="inline-flex items-center rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-700">Published v{w.publishedVersion}</span> : <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">Draft</span>}
                      {w.published && w.hasUnpublishedChanges && <span className="inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700" title="Draft has changes not yet published">Unpublished changes</span>}
                      {catalog?.triggers[w.trigger]?.delivery === false && <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700" title="Trigger contract only — delivery infrastructure not yet wired">Contract only</span>}
                    </div>
                    {w.description && <p className="mt-0.5 text-[12px] text-ink-muted">{w.description}</p>}
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1">
                      {(w.hasUnpublishedChanges || !w.published) && <button type="button" title="Publish" disabled={busyId === w.id} onClick={() => publish(w)} className="flex h-8 w-8 items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"><UploadCloud size={14} /></button>}
                      <button type="button" title={w.published ? 'Run now (real)' : 'Publish before running'} disabled={busyId === w.id || !w.published} onClick={() => runNow(w)} className="flex h-8 w-8 items-center justify-center rounded-lg text-brand-600 hover:bg-brand-50 disabled:opacity-40"><Zap size={14} /></button>
                      <button type="button" title="Test (dry-run)" disabled={busyId === w.id} onClick={() => test(w)} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-subtle hover:bg-brand-50 hover:text-brand-600 disabled:opacity-50"><Play size={14} /></button>
                      <button type="button" title={w.isActive ? 'Pause' : 'Enable'} disabled={busyId === w.id} onClick={() => toggle(w)} className={['flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-50', w.isActive ? 'text-emerald-600 hover:bg-emerald-50' : 'text-ink-subtle hover:bg-surface-2'].join(' ')}><Power size={14} /></button>
                      <button type="button" title="Edit draft" disabled={busyId === w.id} onClick={() => setEditing(w)} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-subtle hover:bg-surface-2 hover:text-brand-600 disabled:opacity-50"><Pencil size={14} /></button>
                      <button type="button" title="Duplicate as draft" disabled={busyId === w.id} onClick={() => dup(w)} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-subtle hover:bg-surface-2 hover:text-brand-600 disabled:opacity-50"><Copy size={14} /></button>
                      {!w.isSystem && <button type="button" title="Delete" disabled={busyId === w.id} onClick={() => remove(w)} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-subtle hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"><Trash2 size={14} /></button>}
                    </div>
                  )}
                </div>

                {/* rule flow: WHEN → IF → THEN */}
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-700 ring-1 ring-inset ring-brand-100">{triggerIcon(w.trigger)} {catalog?.triggers[w.trigger]?.label ?? w.trigger}</span>
                  {w.conditionClass && (<><ArrowRight size={13} className="text-ink-subtle" /><span className="inline-flex items-center rounded-md bg-violet-50 px-2 py-1 text-[11px] font-semibold text-violet-700">if {CLASS_LABEL[w.conditionClass]}</span></>)}
                  <ArrowRight size={13} className="text-ink-subtle" />
                  {w.actions.map((a, i) => { const t = parseSpec(a).type; return (
                    <span key={i} className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-1 text-[11px] font-semibold text-ink-muted ring-1 ring-inset ring-line">{ACTION_ICON[t]} {catalog?.actions[t]?.label ?? t}</span>
                  ); })}
                </div>

                <div className="mt-2.5 flex items-center gap-3 border-t border-line pt-2 text-[11px] text-ink-subtle">
                  <span className="inline-flex items-center gap-1"><Activity size={11} /> {w.runCount} run(s)</span>
                  {w.lastRunAt && <span className="inline-flex items-center gap-1"><History size={11} /> last {timeAgo(w.lastRunAt)}</span>}
                </div>
              </div>
            ))}
          </div>
        </main>

        {/* M17-1: Runs ledger — статусы/тайминг + drill-in в step-log */}
        <aside className="hidden w-[320px] shrink-0 flex-col overflow-y-auto border-l border-line bg-surface/40 p-3 lg:flex">
          <div className="mb-2 flex items-center gap-1.5 px-1">
            <Activity size={12} className="text-brand-600" />
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-subtle">Runs</p>
            <select value={runFilter} onChange={(e) => setRunFilter(e.target.value as WorkflowRunStatus | 'ALL')}
              className="ml-auto h-7 rounded-md border border-line bg-white px-2 text-[11px] font-semibold text-ink-muted focus:border-brand-500 focus:outline-none">
              {RUN_FILTERS.map((f) => <option key={f} value={f}>{f === 'ALL' ? 'All statuses' : STATUS_META[f]?.label ?? f}</option>)}
            </select>
          </div>
          {loading ? [...Array(5)].map((_, i) => <div key={i} className="skeleton mb-2 h-16 rounded-lg" />) : filteredRuns.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line px-3 py-8 text-center text-[12px] text-ink-subtle">No runs{runFilter !== 'ALL' ? ` with status ${STATUS_META[runFilter]?.label}` : ''} yet. Reclassify a reply or book a meeting to trigger a workflow.</div>
          ) : filteredRuns.map((r) => {
            const isTest = r.summary.startsWith('[test]');
            return (
              <button key={r.id} type="button" onClick={() => openRun(r.id)}
                className={['mb-2 w-full rounded-lg border px-3 py-2 text-left shadow-xs transition-colors hover:border-brand-300 hover:bg-brand-50/30', openRunId === r.id ? 'border-brand-400 bg-brand-50/40 ring-1 ring-inset ring-brand-100' : isTest ? 'border-amber-200 bg-amber-50/50' : 'border-line bg-surface'].join(' ')}>
                <div className="flex items-center gap-1.5">
                  <span className="text-brand-600">{triggerIcon(r.trigger)}</span>
                  <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-ink">{r.workflowName}</span>
                  {r.status ? <StatusPill status={r.status} size="xs" /> : isTest ? <span className="shrink-0 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-bold uppercase text-amber-700">test</span> : null}
                </div>
                {r.lead && <p className="mt-0.5 text-[11px] font-medium text-ink-muted">{r.lead}</p>}
                <p className="mt-0.5 truncate text-[11px] leading-4 text-ink-subtle">{isTest ? r.summary.replace(/^\[test\]\s*/, '') : r.summary}</p>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-ink-subtle">
                  <span className="inline-flex items-center gap-0.5"><Clock size={9} /> {fmtDuration(r.durationMs)}</span>
                  {r.version != null && <span className="inline-flex items-center rounded bg-brand-50 px-1 font-bold text-brand-600">v{r.version}</span>}
                  {(r.attemptCount ?? 0) > 1 && <span className="inline-flex items-center gap-0.5"><RotateCcw size={9} /> {r.attemptCount} tries</span>}
                  {(r.dedupeCount ?? 0) > 0 && <span className="inline-flex items-center gap-0.5 text-violet-600">×{(r.dedupeCount ?? 0) + 1} fired</span>}
                  <span className="ml-auto">{timeAgo(r.createdAt)}</span>
                  <ChevronRight size={11} />
                </div>
              </button>
            );
          })}
        </aside>
      </div>

      {editing && catalog && (
        <WorkflowModal workflow={editing === 'new' ? null : editing} catalog={catalog}
          onClose={() => setEditing(null)} onDone={() => { setEditing(null); reload(); }} />
      )}

      {secretsOpen && <SecretsModal canManage={canManage} onClose={() => setSecretsOpen(false)} />}

      {/* M17-1: step-log drawer — главный proof, что run-ledger не декоративный */}
      {openRunId && (
        <RunDetailDrawer detail={detail} loading={detailLoading} canManage={canManage}
          onClose={() => { setOpenRunId(null); setDetail(null); }} onRetry={retryRun} onRerun={rerunRun} />
      )}
    </>
  );
}

/* ══════════════════ M17-1: run-detail / step-log drawer ══════════════════ */
function RunDetailDrawer({ detail, loading, canManage, onClose, onRetry, onRerun }: { detail: WorkflowRunDetail | null; loading: boolean; canManage: boolean; onClose: () => void; onRetry: () => void; onRerun: () => void }) {
  const [openStep, setOpenStep] = useState<string | null>(null);
  const run = detail?.run;
  const retryable = run && (run.status === 'FAILED' || run.status === 'PARTIAL');
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />
      <div className="relative z-10 flex h-full w-full max-w-[480px] flex-col bg-surface shadow-2xl">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Activity size={16} className="text-brand-600" />
          <h2 className="min-w-0 flex-1 truncate text-[14px] font-bold text-ink">{run?.workflowName ?? 'Run'} · run detail</h2>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-subtle hover:bg-surface-2"><X size={16} /></button>
        </div>

        {loading && !run ? (
          <div className="flex flex-1 items-center justify-center text-ink-subtle"><Loader2 size={20} className="animate-spin" /></div>
        ) : !run ? (
          <div className="flex flex-1 items-center justify-center text-[13px] text-ink-subtle">Run not found.</div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {/* run header */}
            <div className="rounded-xl border border-line bg-surface-2/30 p-3.5">
              <div className="flex items-center gap-2">
                <StatusPill status={run.status} />
                <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">{triggerIcon(run.trigger)} {run.trigger.replace(/_/g, ' ').toLowerCase()}</span>
                {run.version != null && <span className="inline-flex items-center rounded-md bg-violet-50 px-1.5 py-0.5 text-[11px] font-bold text-violet-700" title="Executed workflow version">v{run.version}</span>}
                <span className="ml-auto text-[11px] text-ink-subtle">{fmtDuration(run.durationMs)}</span>
              </div>
              {run.lead && <p className="mt-2 text-[12.5px] font-semibold text-ink">{run.lead}</p>}
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-ink-subtle">
                <span>Attempts: <b className="text-ink-muted">{run.attemptCount}</b></span>
                <span>Duplicates: <b className="text-ink-muted">{run.dedupeCount}</b></span>
                {run.attributionMode && <span className="col-span-2">Attribution: <b className="text-ink-muted">{run.attributionMode}</b></span>}
                <span className="col-span-2 truncate">Idempotency: <code className="rounded bg-surface-2 px-1 text-[10px] text-ink-muted">{run.idempotencyKey}</code></span>
              </div>
              {run.error && <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-700"><AlertTriangle size={12} className="mt-0.5 shrink-0" /> {run.error}</p>}
            </div>

            {/* steps timeline */}
            <p className="mb-2 mt-4 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-subtle">Steps · {detail!.steps.length}</p>
            <div className="space-y-2">
              {detail!.steps.length === 0 ? <p className="text-[12px] text-ink-subtle">No steps recorded.</p> : detail!.steps.map((s) => {
                const expanded = openStep === s.id;
                const hasDetail = s.error || (s.output != null) || (s.input != null);
                return (
                  <div key={s.id} className="overflow-hidden rounded-lg border border-line bg-surface">
                    <button type="button" disabled={!hasDetail} onClick={() => setOpenStep(expanded ? null : s.id)} className="flex w-full items-center gap-2 px-3 py-2 text-left disabled:cursor-default">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-surface-2 text-[10px] font-bold text-ink-subtle">{s.order + 1}</span>
                      <span className="text-ink-muted">{ACTION_ICON[s.action]}</span>
                      <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-ink">{s.resultSummary || s.action}</span>
                      <StatusPill status={s.status} size="xs" />
                      <span className="shrink-0 text-[10px] text-ink-subtle">{fmtDuration(s.durationMs)}</span>
                      {hasDetail && <ChevronRight size={12} className={`shrink-0 text-ink-subtle transition-transform ${expanded ? 'rotate-90' : ''}`} />}
                    </button>
                    {expanded && (
                      <div className="border-t border-line bg-surface-2/30 px-3 py-2 text-[11px]">
                        {s.error && <div className="mb-1.5"><span className="font-semibold text-rose-600">error</span><pre className="mt-0.5 whitespace-pre-wrap break-words text-[10.5px] text-rose-700">{s.error}</pre></div>}
                        {s.input != null && <div className="mb-1.5"><span className="font-semibold text-ink-muted">input</span><pre className="mt-0.5 overflow-x-auto rounded bg-surface px-2 py-1 text-[10.5px] text-ink-subtle">{JSON.stringify(s.input, null, 2)}</pre></div>}
                        {s.output != null && <div><span className="font-semibold text-ink-muted">output</span><pre className="mt-0.5 overflow-x-auto rounded bg-surface px-2 py-1 text-[10.5px] text-ink-subtle">{JSON.stringify(s.output, null, 2)}</pre></div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {run && canManage && (
          <div className="flex items-center gap-2 border-t border-line px-4 py-3">
            {retryable && <Button size="sm" variant="secondary" loading={loading} onClick={onRetry}><RotateCcw size={14} /> Retry failed steps</Button>}
            <Button size="sm" variant="ghost" loading={loading} onClick={onRerun}><RefreshCw size={14} /> Re-run from start</Button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════ Create / edit ══════════════════ */
function WorkflowModal({ workflow, catalog, onClose, onDone }: { workflow: Workflow | null; catalog: WorkflowCatalog; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const isSystem = workflow?.isSystem ?? false;
  const [name, setName] = useState(workflow?.name ?? '');
  const [description, setDescription] = useState(workflow?.description ?? '');
  const [trigger, setTrigger] = useState<WorkflowTrigger>(workflow?.trigger ?? 'REPLY_RECEIVED');
  const [conditionClass, setConditionClass] = useState<WorkflowConditionClass>(workflow?.conditionClass ?? null);
  const [actions, setActions] = useState<string[]>(workflow?.actions ?? []);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');

  const triggerKeys = Object.keys(catalog.triggers) as WorkflowTrigger[];
  const supportsClass = catalog.triggers[trigger]?.supportsClass;

  async function submit() {
    setErr('');
    if (!name.trim()) { setErr('Name is required.'); return; }
    if (actions.length === 0) { setErr('Pick at least one action.'); return; }
    setBusy(true);
    const payload: WorkflowInput = { name: name.trim(), description: description.trim() || undefined, trigger, conditionClass: supportsClass ? conditionClass : null, actions };
    try {
      if (workflow) await workflowsApi.update(workflow.id, isSystem ? { name: payload.name, description: payload.description, actions: payload.actions } : payload);
      else await workflowsApi.create(payload);
      toast.success(workflow ? 'Workflow saved' : 'Workflow created', payload.name);
      onDone();
    } catch (e) { const error = e as { response?: { data?: { error?: string } } }; setErr(error.response?.data?.error || 'Could not save.'); }
    finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title={workflow ? (isSystem ? 'Edit system workflow' : 'Edit workflow') : 'New workflow'} size="lg"
      footer={<><Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button><Button variant="primary" size="sm" loading={busy} disabled={!name.trim() || actions.length === 0} onClick={submit}>{workflow ? 'Save' : 'Create'}</Button></>}>
      <div className="space-y-3 p-4">
        {isSystem && <div className="flex items-start gap-2 rounded-lg border border-line bg-surface-2/40 px-3 py-2 text-[12px] text-ink-muted"><Lock size={13} className="mt-0.5 shrink-0" /> System workflow — you can rename it and change its actions, but the trigger and condition are fixed.</div>}
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Hot reply → handoff" />
        <Input label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this rule does" />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium text-ink-muted">When (trigger)</label>
            <select value={trigger} disabled={isSystem} onChange={(e) => { setTrigger(e.target.value as WorkflowTrigger); setConditionClass(null); }}
              className="h-10 rounded-lg border border-[var(--border-strong)] bg-white px-3 text-[14px] text-ink focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:opacity-60">
              {triggerKeys.map((t) => <option key={t} value={t}>{catalog.triggers[t].label}</option>)}
            </select>
            <p className="text-[11px] text-ink-subtle">{catalog.triggers[trigger]?.description}</p>
          </div>
          {supportsClass && (
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-medium text-ink-muted">If reply is</label>
              <select value={conditionClass ?? ''} disabled={isSystem} onChange={(e) => setConditionClass((e.target.value || null) as WorkflowConditionClass)}
                className="h-10 rounded-lg border border-[var(--border-strong)] bg-white px-3 text-[14px] text-ink focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:opacity-60">
                <option value="">Any class</option>
                {Object.entries(CLASS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-ink-muted">Then do (actions, in order)</label>
          <ActionBuilder actions={actions} setActions={setActions} catalog={catalog} />
        </div>
        {err && <p className="text-[12px] text-rose-600">{err}</p>}
      </div>
    </Modal>
  );
}

/* ══════════════════ M17-3: action builder (typed blocks + params) ══════════════════ */
interface ABlock { id: string; type: string; config: Record<string, unknown>; }
type Cond = { field: string; op: string; value?: string };
type Case = { value: string; span: number };
const COND_OPS = ['eq', 'neq', 'contains', 'gt', 'gte', 'lt', 'lte', 'is_empty', 'is_not_empty', 'in'];
const KIND_LABEL: Record<string, string> = { lead: 'Lead', record: 'Record', list: 'List', logic: 'Logic', delay: 'Delay', assign: 'Assign', ai: 'AI', http: 'HTTP', transform: 'Transform', integration: 'Integration' };
const KIND_ORDER = ['lead', 'record', 'list', 'logic', 'delay', 'assign', 'ai', 'http', 'transform', 'integration'];
const fieldCls = 'h-8 w-full rounded-md border border-line bg-white px-2 text-[12px] text-ink focus:border-brand-500 focus:outline-none';

function defaultConfig(params: WorkflowActionParam[]): Record<string, unknown> {
  const c: Record<string, unknown> = {};
  for (const p of params) {
    if (p.type === 'match') c[p.key] = 'all';
    else if (p.type === 'boolean') c[p.key] = false;
    else if (p.type === 'kv') c[p.key] = {};
    else if (p.type === 'cases') c[p.key] = [{ value: '', span: 1 }];
    else if (p.type === 'csv' || p.type === 'conditions') c[p.key] = [];
  }
  return c;
}
function serializeBlock(b: ABlock, catalog: WorkflowCatalog): string {
  const meta = catalog.actions[b.type];
  if (!meta?.params?.length) return b.type; // голый ключ для действий без параметров (lead)
  const config: Record<string, unknown> = {};
  for (const p of meta.params) {
    const v = b.config[p.key];
    if (v === undefined || v === '' || v === null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (p.type === 'kv' && v && typeof v === 'object' && Object.keys(v as object).length === 0) continue;
    config[p.key] = v;
  }
  return JSON.stringify({ type: b.type, config });
}

function ActionBuilder({ actions, setActions, catalog }: { actions: string[]; setActions: (a: string[]) => void; catalog: WorkflowCatalog }) {
  const [blocks, setBlocks] = useState<ABlock[]>(() => actions.map((a) => { const s = parseSpec(a); return { id: crypto.randomUUID(), type: s.type, config: s.config }; }));
  function push(next: ABlock[]) { setBlocks(next); setActions(next.map((b) => serializeBlock(b, catalog))); }
  function add(type: string) { if (!type) return; const meta = catalog.actions[type]; push([...blocks, { id: crypto.randomUUID(), type, config: defaultConfig(meta?.params ?? []) }]); }
  function remove(id: string) { push(blocks.filter((b) => b.id !== id)); }
  function move(id: string, dir: -1 | 1) { const i = blocks.findIndex((b) => b.id === id); const j = i + dir; if (j < 0 || j >= blocks.length) return; const next = [...blocks]; [next[i], next[j]] = [next[j], next[i]]; push(next); }
  function setCfg(id: string, key: string, val: unknown) { push(blocks.map((b) => (b.id === id ? { ...b, config: { ...b.config, [key]: val } } : b))); }

  const grouped = useMemo(() => {
    const g: Record<string, [string, { label: string }][]> = {};
    for (const [k, m] of Object.entries(catalog.actions)) { const kind = m.kind ?? 'lead'; (g[kind] = g[kind] || []).push([k, m]); }
    return g;
  }, [catalog]);

  return (
    <div className="space-y-2">
      {blocks.length === 0 && <p className="rounded-lg border border-dashed border-line px-3 py-3 text-center text-[12px] text-ink-subtle">No actions yet — add one below.</p>}
      {blocks.map((b, idx) => {
        const meta = catalog.actions[b.type];
        const params = meta?.params ?? [];
        return (
          <div key={b.id} className="rounded-lg border border-line bg-surface p-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-brand-600 text-white">{ACTION_ICON[b.type] ?? <Zap size={11} />}</span>
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink">{idx + 1}. {meta?.label ?? b.type}</span>
              <button type="button" title="Move up" disabled={idx === 0} onClick={() => move(b.id, -1)} className="flex h-6 w-6 items-center justify-center rounded text-ink-subtle hover:bg-surface-2 disabled:opacity-30"><ArrowUp size={13} /></button>
              <button type="button" title="Move down" disabled={idx === blocks.length - 1} onClick={() => move(b.id, 1)} className="flex h-6 w-6 items-center justify-center rounded text-ink-subtle hover:bg-surface-2 disabled:opacity-30"><ArrowDown size={13} /></button>
              <button type="button" title="Remove" onClick={() => remove(b.id)} className="flex h-6 w-6 items-center justify-center rounded text-ink-subtle hover:bg-rose-50 hover:text-rose-600"><Trash2 size={13} /></button>
            </div>
            {params.length > 0 && (
              <div className="mt-2 space-y-2 border-t border-line pt-2">
                {params.map((p) => <ParamField key={p.key} p={p} value={b.config[p.key]} onChange={(v) => setCfg(b.id, p.key, v)} />)}
              </div>
            )}
            {meta?.description && <p className="mt-1.5 text-[10.5px] leading-3.5 text-ink-subtle">{meta.description}</p>}
          </div>
        );
      })}
      <select value="" onChange={(e) => { add(e.target.value); e.currentTarget.value = ''; }}
        className="h-9 w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 text-[13px] font-medium text-ink-muted focus:border-brand-500 focus:outline-none">
        <option value="">+ Add action…</option>
        {KIND_ORDER.filter((k) => grouped[k]).map((k) => (
          <optgroup key={k} label={KIND_LABEL[k]}>{grouped[k].map(([key, m]) => <option key={key} value={key}>{m.label}</option>)}</optgroup>
        ))}
      </select>
    </div>
  );
}

function ParamField({ p, value, onChange }: { p: WorkflowActionParam; value: unknown; onChange: (v: unknown) => void }) {
  if (p.type === 'boolean') return <label className="flex items-center gap-1.5 text-[12px] text-ink-muted"><input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} /> {p.label}</label>;
  const wrap = (control: React.ReactNode) => <div><label className="mb-0.5 block text-[10.5px] font-medium uppercase tracking-wide text-ink-subtle">{p.label}</label>{control}</div>;
  if (p.type === 'match') return wrap(<select className={fieldCls} value={(value as string) || 'all'} onChange={(e) => onChange(e.target.value)}><option value="all">Match all</option><option value="any">Match any</option></select>);
  if (p.type === 'number') return wrap(<input type="number" className={fieldCls} value={value === undefined || value === null ? '' : String(value)} onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} placeholder={p.placeholder} />);
  if (p.type === 'csv') return wrap(<input className={fieldCls} value={Array.isArray(value) ? (value as string[]).join(', ') : ''} onChange={(e) => onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} placeholder={p.placeholder} />);
  if (p.type === 'kv') return wrap(<KvEditor value={(value as Record<string, unknown>) || {}} onChange={onChange} />);
  if (p.type === 'conditions') return wrap(<ConditionsEditor value={(value as Cond[]) || []} onChange={onChange} />);
  if (p.type === 'cases') return wrap(<CasesEditor value={(value as Case[]) || []} onChange={onChange} />);
  if (p.type === 'method') return wrap(<select className={fieldCls} value={(value as string) || 'GET'} onChange={(e) => onChange(e.target.value)}>{['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].map((m) => <option key={m} value={m}>{m}</option>)}</select>);
  if (p.type === 'transform') return wrap(<TransformEditor value={(value as TRow[]) || []} onChange={onChange} />);
  return wrap(<input className={fieldCls} value={(value as string) || ''} onChange={(e) => onChange(e.target.value)} placeholder={p.placeholder || (p.type === 'objectKey' ? 'companies' : p.type === 'listId' ? 'list id' : '')} />);
}

function KvEditor({ value, onChange }: { value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const [rows, setRows] = useState<{ k: string; v: string }[]>(() => { const e = Object.entries(value || {}); return e.length ? e.map(([k, v]) => ({ k, v: String(v) })) : [{ k: '', v: '' }]; });
  function emit(next: { k: string; v: string }[]) { setRows(next); const obj: Record<string, unknown> = {}; next.forEach((r) => { if (r.k.trim()) obj[r.k.trim()] = r.v; }); onChange(obj); }
  return (
    <div className="space-y-1">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-1">
          <input className={fieldCls} placeholder="attribute" value={r.k} onChange={(e) => emit(rows.map((x, j) => (j === i ? { ...x, k: e.target.value } : x)))} />
          <input className={fieldCls} placeholder="value" value={r.v} onChange={(e) => emit(rows.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)))} />
          <button type="button" onClick={() => emit(rows.filter((_, j) => j !== i))} className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-ink-subtle hover:text-rose-600"><X size={12} /></button>
        </div>
      ))}
      <button type="button" onClick={() => setRows([...rows, { k: '', v: '' }])} className="text-[11px] font-semibold text-brand-600">+ field</button>
    </div>
  );
}

function ConditionsEditor({ value, onChange }: { value: Cond[]; onChange: (v: Cond[]) => void }) {
  return (
    <div className="space-y-1">
      {value.map((c, i) => (
        <div key={i} className="flex items-center gap-1">
          <input className={fieldCls} placeholder="field" value={c.field} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, field: e.target.value } : x)))} />
          <select className={`${fieldCls} w-28`} value={c.op} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, op: e.target.value } : x)))}>{COND_OPS.map((o) => <option key={o} value={o}>{o}</option>)}</select>
          {!['is_empty', 'is_not_empty'].includes(c.op) && <input className={fieldCls} placeholder="value" value={c.value ?? ''} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />}
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-ink-subtle hover:text-rose-600"><X size={12} /></button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...value, { field: '', op: 'eq', value: '' }])} className="text-[11px] font-semibold text-brand-600">+ condition</button>
    </div>
  );
}

function CasesEditor({ value, onChange }: { value: Case[]; onChange: (v: Case[]) => void }) {
  return (
    <div className="space-y-1">
      {value.map((c, i) => (
        <div key={i} className="flex items-center gap-1">
          <input className={fieldCls} placeholder="value" value={c.value} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
          <input type="number" className={`${fieldCls} w-20`} placeholder="span" value={String(c.span ?? 1)} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, span: Number(e.target.value) || 1 } : x)))} />
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-ink-subtle hover:text-rose-600"><X size={12} /></button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...value, { value: '', span: 1 }])} className="text-[11px] font-semibold text-brand-600">+ case</button>
    </div>
  );
}

/* M17-4: TRANSFORM extract rows (var ← path), HTTP/AI output chaining */
type TRow = { as: string; path: string; required?: boolean };
function TransformEditor({ value, onChange }: { value: TRow[]; onChange: (v: TRow[]) => void }) {
  return (
    <div className="space-y-1">
      {value.map((r, i) => (
        <div key={i} className="flex items-center gap-1">
          <input className={fieldCls} placeholder="var name" value={r.as} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, as: e.target.value } : x)))} />
          <span className="shrink-0 text-[11px] text-ink-subtle">←</span>
          <input className={fieldCls} placeholder="steps.2.body.id" value={r.path} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, path: e.target.value } : x)))} />
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-ink-subtle hover:text-rose-600"><X size={12} /></button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...value, { as: '', path: '' }])} className="text-[11px] font-semibold text-brand-600">+ extract</button>
    </div>
  );
}

/* ══════════════════ M17-4: secrets manager (value write-only, masked) ══════════════════ */
function SecretsModal({ canManage, onClose }: { canManage: boolean; onClose: () => void }) {
  const toast = useToast();
  const [secrets, setSecrets] = useState<{ key: string; updatedAt: string }[]>([]);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');
  const [busy, setBusy] = useState(false);
  function load() { workflowsApi.listSecrets().then((r) => { setSecrets(r.secrets); setAvailable(r.available); }).catch(() => {}).finally(() => setLoading(false)); }
  useEffect(() => { load(); }, []);
  async function add() {
    if (!newKey.trim() || !newVal.trim()) return;
    setBusy(true);
    try { await workflowsApi.setSecret(newKey.trim(), newVal); setNewKey(''); setNewVal(''); load(); toast.success('Secret saved', newKey.trim()); }
    catch (e) { const err = e as { response?: { data?: { error?: string } } }; toast.error('Could not save secret', err.response?.data?.error || 'Try again.'); }
    finally { setBusy(false); }
  }
  async function del(key: string) {
    if (!window.confirm(`Delete secret "${key}"?`)) return;
    try { const r = await workflowsApi.deleteSecret(key); load(); toast.success('Secret deleted', r.warning || key); } catch { toast.error('Could not delete', key); }
  }
  return (
    <Modal open onClose={onClose} title="Workflow secrets" size="md" footer={<Button variant="secondary" size="sm" onClick={onClose}>Close</Button>}>
      <div className="space-y-3 p-4">
        <p className="text-[12px] text-ink-muted">Referenced in HTTP blocks as <code className="rounded bg-surface-2 px-1 text-[11px]">{'{{secret.NAME}}'}</code>. Values are encrypted and never shown again or logged.</p>
        {!available && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-700">Secret store is not configured on the server (WORKFLOW_SECRET_ENCRYPTION_KEY). Secrets can’t be saved.</div>}
        {loading ? <div className="skeleton h-16 rounded-lg" /> : secrets.length === 0 ? <p className="text-[12px] text-ink-subtle">No secrets yet.</p> : (
          <div className="divide-y divide-line rounded-lg border border-line">
            {secrets.map((s) => (
              <div key={s.key} className="flex items-center gap-2 px-3 py-2">
                <KeyRound size={13} className="text-ink-subtle" />
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink">{s.key}</span>
                <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-subtle">••••••••</code>
                {canManage && <button type="button" onClick={() => del(s.key)} className="flex h-7 w-7 items-center justify-center rounded text-ink-subtle hover:text-rose-600"><Trash2 size={13} /></button>}
              </div>
            ))}
          </div>
        )}
        {canManage && available && (
          <div className="flex items-end gap-2 border-t border-line pt-3">
            <div className="flex-1"><label className="mb-0.5 block text-[10.5px] font-medium uppercase tracking-wide text-ink-subtle">Name</label><input className={fieldCls} placeholder="SLACK_WEBHOOK_URL" value={newKey} onChange={(e) => setNewKey(e.target.value)} /></div>
            <div className="flex-1"><label className="mb-0.5 block text-[10.5px] font-medium uppercase tracking-wide text-ink-subtle">Value</label><input className={fieldCls} type="password" placeholder="secret value" value={newVal} onChange={(e) => setNewVal(e.target.value)} /></div>
            <Button variant="primary" size="sm" loading={busy} disabled={!newKey.trim() || !newVal.trim()} onClick={add}>Save</Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
