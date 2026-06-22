'use client';

/**
 * BulkRunPanel — массовый запуск AI-атрибута (M9.2, согласовано с GPT).
 * Поток: config + preflight (billable rows) → server bulk-run → progress + ledger
 * → per-record результаты с честными частичными ошибками.
 *
 * Принципы (по корректировкам GPT):
 *  - scope явный: selected (recordIds[]) или view (objectKey + filters + search; backend сам считает total);
 *  - preflight показывает total / already filled / will run / estimated credits;
 *  - ledger разделён: Reserved (макс на старте), Spent (только успешные), Failed not charged;
 *  - partial success — отдельный статус «Completed with errors», без фейкового успеха;
 *  - поллинг с лимитом (2 мин / 100 итераций) → ручное обновление статуса;
 *  - 402 (нехватка кредитов) → честный error-state, запуск не стартует.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X, Loader2, Sparkles, Coins, AlertTriangle, CheckCircle2, XCircle, Play, RefreshCw, SkipForward, Hash,
} from 'lucide-react';
import {
  runAiBulkPreflight,
  runAiBulkForView,
  getAiBulkRunStatus,
  getAiBulkRunRuns,
  type AiBulkPreflight,
  type AiBulkRunStatus,
  type AiBulkRunRecordResult,
  type AiBulkScopeParams,
  type AiAutofillType,
  type CrmViewFilter,
} from '@/lib/crmApi';

export interface BulkAiAttr { id: string; name: string; aiType: AiAutofillType }

interface Props {
  open: boolean;
  onClose: () => void;
  aiAttrs: BulkAiAttr[];
  defaultAttributeId?: string;
  objectKey: string;
  filters?: CrmViewFilter[];
  search?: string;
  selectedRecordIds: string[];
  viewTotal: number;
  recordName: (id: string) => string;
  canManage: boolean;
  onCompleted: () => void;
}

type Step = 'config' | 'running' | 'done' | 'error' | 'timeout';

const MAX_POLLS = 100;     // ~2 минуты при интервале 1200мс
const POLL_INTERVAL = 1200;

export default function BulkRunPanel(props: Props) {
  const { open, onClose, aiAttrs, defaultAttributeId, objectKey, filters, search, selectedRecordIds, viewTotal, recordName, canManage, onCompleted } = props;

  const [attrId, setAttrId] = useState<string>(defaultAttributeId ?? aiAttrs[0]?.id ?? '');
  const [scopeKind, setScopeKind] = useState<'selected' | 'view'>(selectedRecordIds.length > 0 ? 'selected' : 'view');
  const [skipExisting, setSkipExisting] = useState(true);

  const [step, setStep] = useState<Step>('config');
  const [preflight, setPreflight] = useState<AiBulkPreflight | null>(null);
  const [preLoading, setPreLoading] = useState(false);
  const [preError, setPreError] = useState<string | null>(null);

  const [status, setStatus] = useState<AiBulkRunStatus | null>(null);
  const [runs, setRuns] = useState<Array<AiBulkRunRecordResult & { _name: string }>>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const bulkRunIdRef = useRef<string | null>(null);
  const pollCountRef = useRef(0);
  const cancelledRef = useRef(false);
  // имя записи фиксируем в момент завершения (до родительского reload, иначе упавшая/архивная запись теряет имя)
  const recordNameRef = useRef(recordName);
  useEffect(() => { recordNameRef.current = recordName; });

  const buildScope = useCallback((): AiBulkScopeParams => {
    if (scopeKind === 'selected') {
      return { attributeId: attrId, recordIds: selectedRecordIds, skipExisting };
    }
    return { attributeId: attrId, objectKey, filters, search, skipExisting };
  }, [scopeKind, attrId, selectedRecordIds, objectKey, filters, search, skipExisting]);

  // ── Preflight: пересчитываем billable-строки при смене атрибута/scope/skip ──
  useEffect(() => {
    if (!open || step !== 'config' || !attrId) return;
    let alive = true;
    setPreLoading(true);
    setPreError(null);
    runAiBulkPreflight(buildScope())
      .then((p) => { if (alive) setPreflight(p); })
      .catch((e: any) => { if (alive) { setPreflight(null); setPreError(e?.response?.data?.error ?? 'Failed to calculate preflight'); } })
      .finally(() => { if (alive) setPreLoading(false); });
    return () => { alive = false; };
  }, [open, step, attrId, buildScope]);

  // ── Сброс состояния при открытии ──
  useEffect(() => {
    if (open) {
      cancelledRef.current = false;
      setStep('config');
      setStatus(null);
      setRuns([]);
      setErrorMsg(null);
      bulkRunIdRef.current = null;
      pollCountRef.current = 0;
      setScopeKind(selectedRecordIds.length > 0 ? 'selected' : 'view');
      setAttrId((cur) => (aiAttrs.some((a) => a.id === cur) ? cur : (defaultAttributeId ?? aiAttrs[0]?.id ?? '')));
    } else {
      cancelledRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Escape ──
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && step !== 'running') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, step]);

  const pollOnce = useCallback(async () => {
    const id = bulkRunIdRef.current;
    if (!id || cancelledRef.current) return;
    try {
      const s = await getAiBulkRunStatus(id);
      if (cancelledRef.current) return;
      setStatus(s);
      const finished = s.status === 'SUCCEEDED' || s.status === 'FAILED';
      if (finished) {
        try { const r = await getAiBulkRunRuns(id); if (!cancelledRef.current) setRuns(r.runs.map((x) => ({ ...x, _name: recordNameRef.current(x.recordId) }))); } catch { /* per-record best-effort */ }
        if (!cancelledRef.current) { setStep('done'); onCompleted(); }
        return;
      }
      pollCountRef.current += 1;
      if (pollCountRef.current >= MAX_POLLS) { setStep('timeout'); return; }
      setTimeout(pollOnce, POLL_INTERVAL);
    } catch (e: any) {
      if (cancelledRef.current) return;
      setErrorMsg(e?.response?.data?.error ?? 'Status polling error');
      setStep('error');
    }
  }, [onCompleted]);

  async function start() {
    if (!canManage || !attrId) return;
    setErrorMsg(null);
    setStep('running');
    pollCountRef.current = 0;
    try {
      const res = await runAiBulkForView(buildScope());
      bulkRunIdRef.current = res.bulkRunId;
      setStatus({ id: res.bulkRunId, status: 'PENDING', totalCount: res.estimatedCount, pendingCount: res.estimatedCount, successCount: 0, failedCount: 0, creditsReserved: res.estimatedCost, creditsSpent: 0, startedAt: null, completedAt: null });
      setTimeout(pollOnce, 600);
    } catch (e: any) {
      const code = e?.response?.status;
      const msg = e?.response?.data?.error ?? 'Failed to start bulk run';
      setErrorMsg(code === 402 ? `Not enough credits. ${msg}` : msg);
      setStep('error');
    }
  }

  async function manualRefresh() {
    const id = bulkRunIdRef.current;
    if (!id) return;
    try {
      const s = await getAiBulkRunStatus(id);
      setStatus(s);
      if (s.status === 'SUCCEEDED' || s.status === 'FAILED') {
        try { const r = await getAiBulkRunRuns(id); setRuns(r.runs.map((x) => ({ ...x, _name: recordNameRef.current(x.recordId) }))); } catch { /* noop */ }
        setStep('done'); onCompleted();
      }
    } catch { /* noop */ }
  }

  const attr = aiAttrs.find((a) => a.id === attrId);
  const costPerRow = preflight?.costPerRow ?? (attr?.aiType === 'RESEARCH' ? 10 : 1);
  const selectedCount = selectedRecordIds.length;

  // Итоговый статус-лейбл по GPT: partial success = «Completed with errors»
  const doneLabel = (() => {
    if (!status) return 'Completed';
    if (status.failedCount > 0 && status.successCount > 0) return 'Completed with errors';
    if (status.failedCount > 0 && status.successCount === 0) return 'Failed';
    return 'Completed';
  })();
  const doneTone = doneLabel === 'Completed' ? 'emerald' : doneLabel === 'Failed' ? 'rose' : 'amber';

  const progressPct = status && status.totalCount > 0
    ? Math.round(((status.successCount + status.failedCount + (status.skippedCount ?? 0)) / status.totalCount) * 100)
    : 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => { if (step !== 'running') onClose(); }}
        >
          <motion.div
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
            initial={{ scale: 0.96, opacity: 0, y: 8 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0, y: 8 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* header */}
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><Sparkles size={15} /></span>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-ink">Run AI · bulk</p>
                <p className="text-[11px] text-ink-subtle">Bulk AI run across records</p>
              </div>
              <button type="button" onClick={() => { if (step !== 'running') onClose(); }} disabled={step === 'running'} className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-muted hover:bg-surface-2 disabled:opacity-40"><X size={15} /></button>
            </div>

            <div className="max-h-[70vh] overflow-auto px-4 py-3">
              {!canManage ? (
                <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-[12px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                  <AlertTriangle size={14} /> View-only · members can’t run AI
                </div>
              ) : aiAttrs.length === 0 ? (
                <div className="rounded-lg bg-surface-2 px-3 py-2.5 text-[12px] text-ink-muted">This object has no AI attributes to run.</div>
              ) : (
                <>
                  {/* CONFIG */}
                  {step === 'config' && (
                    <div className="space-y-3">
                      {/* AI attribute */}
                      <div>
                        <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.05em] text-ink-subtle">AI attribute</label>
                        <select value={attrId} onChange={(e) => setAttrId(e.target.value)} className="w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-[12.5px] text-ink focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100">
                          {aiAttrs.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.aiType} · {a.aiType === 'RESEARCH' ? 10 : 1} cr/row</option>)}
                        </select>
                      </div>

                      {/* scope */}
                      <div>
                        <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.05em] text-ink-subtle">Scope</label>
                        <div className="flex gap-1.5">
                          <button type="button" disabled={selectedCount === 0} onClick={() => setScopeKind('selected')} className={['flex-1 rounded-lg border px-2.5 py-2 text-left text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-40', scopeKind === 'selected' ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-line bg-surface text-ink-muted hover:bg-surface-2'].join(' ')}>
                            <span className="block font-semibold">Selected</span>
                            <span className="block text-[11px] text-ink-subtle">{selectedCount} selected</span>
                          </button>
                          <button type="button" onClick={() => setScopeKind('view')} className={['flex-1 rounded-lg border px-2.5 py-2 text-left text-[12px] transition-colors', scopeKind === 'view' ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-line bg-surface text-ink-muted hover:bg-surface-2'].join(' ')}>
                            <span className="block font-semibold">Current view</span>
                            <span className="block text-[11px] text-ink-subtle">~{viewTotal} in view</span>
                          </button>
                        </div>
                      </div>

                      {/* skip existing */}
                      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-2 text-[12px] text-ink-muted">
                        <input type="checkbox" checked={skipExisting} onChange={(e) => setSkipExisting(e.target.checked)} className="h-3.5 w-3.5 rounded border-line text-brand-600 focus:ring-brand-300" />
                        <SkipForward size={13} /> Skip already-filled values
                      </label>

                      {/* preflight summary */}
                      <div className="rounded-lg border border-line bg-surface-2/60 p-3">
                        {preLoading ? (
                          <p className="inline-flex items-center gap-1.5 text-[12px] text-ink-subtle"><Loader2 size={13} className="animate-spin" /> Calculating billable rows…</p>
                        ) : preError ? (
                          <p className="inline-flex items-start gap-1.5 text-[12px] text-rose-600"><AlertTriangle size={13} className="mt-0.5" /> {preError}</p>
                        ) : preflight ? (
                          <div className="space-y-1.5">
                            <Row label="Total in scope" value={String(preflight.totalInScope)} />
                            {skipExisting && <Row label="Already filled · skipped" value={String(preflight.alreadyFilled)} muted />}
                            {!!preflight.manualProtected && preflight.manualProtected > 0 && <Row label="Manual value · protected" value={String(preflight.manualProtected)} muted />}
                            <Row label="Will run" value={String(preflight.willRun)} strong />
                            <div className="my-1 border-t border-line" />
                            <Row label={`Estimated credits (${preflight.willRun} × ${costPerRow})`} value={`${preflight.estimatedCredits} cr`} strong icon={<Coins size={12} />} />
                            <Row label="Balance" value={`${preflight.balance} cr`} muted />
                            {preflight.cappedFrom != null && (
                              <p className="mt-1 inline-flex items-start gap-1 rounded bg-amber-50 px-1.5 py-1 text-[11px] font-medium text-amber-700"><AlertTriangle size={11} className="mt-0.5" /> Scope of {preflight.cappedFrom} records capped to the per-run limit of {preflight.maxBulk}.</p>
                            )}
                            {!preflight.sufficient && preflight.willRun > 0 && (
                              <p className="mt-1 inline-flex items-start gap-1 rounded bg-rose-50 px-1.5 py-1 text-[11px] font-semibold text-rose-600"><AlertTriangle size={11} className="mt-0.5" /> Not enough credits: need {preflight.estimatedCredits}, available {preflight.balance}.</p>
                            )}
                          </div>
                        ) : null}
                      </div>

                      {(() => {
                        const insufficient = !!preflight && preflight.willRun > 0 && !preflight.sufficient;
                        const nothing = !preflight || preflight.willRun === 0;
                        return (
                          <button
                            type="button"
                            disabled={nothing || insufficient || preLoading}
                            onClick={start}
                            className={[
                              'inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg text-[12.5px] font-semibold shadow-xs transition-colors disabled:cursor-not-allowed',
                              insufficient
                                ? 'border border-rose-200 bg-rose-50 text-rose-600 opacity-100' // нехватка — явный «блокированный» вид, не просто бледная синяя
                                : 'bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50',
                            ].join(' ')}
                          >
                            {insufficient
                              ? <><AlertTriangle size={14} /> Not enough credits · need {preflight!.estimatedCredits} cr</>
                              : <><Play size={14} /> {preflight && preflight.willRun > 0 ? `Run AI on ${preflight.willRun} ${preflight.willRun === 1 ? 'record' : 'records'} · ${preflight.estimatedCredits} cr` : 'Nothing to run'}</>}
                          </button>
                        );
                      })()}
                    </div>
                  )}

                  {/* RUNNING */}
                  {step === 'running' && status && (
                    <div className="space-y-3 py-1">
                      <div className="flex items-center gap-2 text-[12.5px] font-semibold text-ink">
                        <Loader2 size={14} className="animate-spin text-brand-600" /> Running… {status.successCount + status.failedCount + (status.skippedCount ?? 0)}/{status.totalCount}
                        <span className="ml-auto inline-flex items-center gap-1 text-[10.5px] font-normal text-ink-subtle" title="bulk run id"><Hash size={10} /> {status.id.slice(-8)}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${progressPct}%` }} /></div>
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <Stat label="Success" value={status.successCount} tone="emerald" />
                        <Stat label="Failed" value={status.failedCount} tone="rose" />
                        <Stat label="Skipped" value={status.skippedCount ?? 0} tone="amber" />
                        <Stat label="Pending" value={status.pendingCount} tone="slate" />
                      </div>
                      <Ledger reserved={status.creditsReserved} spent={status.creditsSpent} failedNotCharged={status.failedCount * costPerRow} />
                      <p className="text-center text-[11px] text-ink-subtle">Keep this open — a real LLM run is in progress.</p>
                    </div>
                  )}

                  {/* TIMEOUT */}
                  {step === 'timeout' && (
                    <div className="space-y-3 py-1">
                      <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-[12px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200"><AlertTriangle size={14} className="mt-0.5" /> Still running. Refresh status later.</div>
                      {status && <Ledger reserved={status.creditsReserved} spent={status.creditsSpent} failedNotCharged={status.failedCount * costPerRow} />}
                      <button type="button" onClick={manualRefresh} className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-line bg-surface text-[12.5px] font-semibold text-ink-muted hover:bg-surface-2"><RefreshCw size={14} /> Refresh status</button>
                    </div>
                  )}

                  {/* ERROR */}
                  {step === 'error' && (
                    <div className="space-y-3 py-1">
                      <div className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2.5 text-[12px] font-semibold text-rose-600 ring-1 ring-inset ring-rose-200"><XCircle size={14} className="mt-0.5" /> {errorMsg ?? 'Run failed to start'}</div>
                      <button type="button" onClick={() => setStep('config')} className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-line bg-surface text-[12.5px] font-semibold text-ink-muted hover:bg-surface-2">Back</button>
                    </div>
                  )}

                  {/* DONE */}
                  {step === 'done' && status && (
                    <div className="space-y-3 py-1">
                      <div className={['flex items-center gap-2 rounded-lg px-3 py-2.5 text-[12.5px] font-bold ring-1 ring-inset',
                        doneTone === 'emerald' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : doneTone === 'rose' ? 'bg-rose-50 text-rose-600 ring-rose-200' : 'bg-amber-50 text-amber-700 ring-amber-200'].join(' ')}>
                        {doneTone === 'emerald' ? <CheckCircle2 size={15} /> : doneTone === 'rose' ? <XCircle size={15} /> : <AlertTriangle size={15} />} {doneLabel}
                        <span className="ml-auto text-[11.5px] font-semibold">{status.successCount} ok · {status.failedCount} failed{status.skippedCount ? ` · ${status.skippedCount} skipped` : ''}</span>
                      </div>
                      <p className="inline-flex items-center gap-1 text-[10.5px] text-ink-subtle" title="bulk run id"><Hash size={10} /> bulk run {status.id.slice(-8)}</p>
                      <Ledger reserved={status.creditsReserved} spent={status.creditsSpent} failedNotCharged={status.failedCount * costPerRow} />
                      {/* per-record results */}
                      <div>
                        <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.05em] text-ink-subtle">Per-record results</p>
                        <div className="max-h-52 space-y-1 overflow-auto rounded-lg border border-line p-1.5">
                          {runs.length === 0 ? (
                            <p className="px-1 py-1 text-[11.5px] text-ink-subtle">Нет детальных результатов.</p>
                          ) : runs.map((r) => {
                            const skipped = r.status === 'SKIPPED_MANUAL_VALUE';
                            return (
                            <div key={r.id} className="flex items-start gap-2 rounded-md px-1.5 py-1 text-[11.5px]">
                              {r.status === 'SUCCEEDED'
                                ? <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-600" />
                                : skipped
                                  ? <SkipForward size={13} className="mt-0.5 shrink-0 text-amber-500" />
                                  : <XCircle size={13} className="mt-0.5 shrink-0 text-rose-500" />}
                              <span className="min-w-0 flex-1">
                                <span className="font-semibold text-ink">{r._name}</span>
                                {r.status === 'SUCCEEDED'
                                  ? <span className="text-ink-subtle"> — {r.outputText ? r.outputText.slice(0, 60) : 'ok'}{r.outputText && r.outputText.length > 60 ? '…' : ''}</span>
                                  : skipped
                                    ? <span className="text-amber-600"> — manual value · protected</span>
                                    : <span className="text-rose-600"> — {humanizeError(r.error)}</span>}
                              </span>
                              <span className={['shrink-0', r.status === 'SUCCEEDED' ? 'text-ink-subtle' : skipped ? 'text-amber-400' : 'text-rose-400'].join(' ')}>{r.status === 'SUCCEEDED' ? `${r.creditsCost} cr` : skipped ? 'skipped' : 'not charged'}</span>
                            </div>
                            );
                          })}
                        </div>
                      </div>
                      <button type="button" onClick={onClose} className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-brand-600 text-[12.5px] font-semibold text-white hover:bg-brand-700">Done</button>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Известные backend-ошибки → короткий английский текст для UI (бэкенд не трогаем).
function humanizeError(err: string | null): string {
  if (!err) return 'failed';
  if (/Запись не найдена/i.test(err)) return 'Record not found (archived/deleted)';
  if (/Недостаточно/i.test(err) || /INSUFFICIENT_CREDITS/i.test(err)) return 'Not enough credits';
  if (/CLASSIFY_REQUIRES_OPTIONS/i.test(err) || /категори/i.test(err)) return 'Attribute has no categories';
  if (/Атрибут не найден/i.test(err)) return 'Attribute not found';
  // Ошибки LLM-провайдера (DeepSeek/Anthropic 4xx/5xx, авторизация, таймаут) не показываем сырыми —
  // не утекаем имя провайдера/ключ в клиентский UI. Полный текст остаётся в AiRun.error/provenance для аудита.
  if (/DeepSeek|Anthropic|authentication|provider|LLM|aborted|timeout|ECONNREFUSED|fetch failed|\b(401|403|429|5\d\d)\b/i.test(err)) return 'AI provider error — please retry';
  return err.length > 80 ? err.slice(0, 80) + '…' : err;
}

function Row({ label, value, strong, muted, icon }: { label: string; value: string; strong?: boolean; muted?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-[12px]">
      <span className={['inline-flex items-center gap-1', muted ? 'text-ink-subtle' : 'text-ink-muted'].join(' ')}>{icon}{label}</span>
      <span className={strong ? 'font-bold text-ink' : muted ? 'text-ink-subtle' : 'font-semibold text-ink-muted'}>{value}</span>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'emerald' | 'rose' | 'slate' | 'amber' }) {
  const c = tone === 'emerald' ? 'text-emerald-700' : tone === 'rose' ? 'text-rose-600' : tone === 'amber' ? 'text-amber-600' : 'text-ink-muted';
  return (
    <div className="rounded-lg border border-line bg-surface py-1.5">
      <div className={['text-[15px] font-bold', c].join(' ')}>{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.05em] text-ink-subtle">{label}</div>
    </div>
  );
}

function Ledger({ reserved, spent, failedNotCharged }: { reserved: number; spent: number; failedNotCharged: number }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2/50 p-2.5">
      <p className="mb-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.05em] text-ink-subtle"><Coins size={11} /> Credits ledger</p>
      <div className="space-y-1">
        <Row label="Reserved (max at start)" value={`${reserved} cr`} muted />
        <Row label="Spent (successful only)" value={`${spent} cr`} strong />
        <Row label="Failed · not charged" value={`${failedNotCharged} cr`} muted />
      </div>
    </div>
  );
}
