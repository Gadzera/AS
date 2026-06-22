'use client';

/**
 * ImportHistoryModal — история импортов объекта + ОТКАТ импорта (M20-2, S337).
 * Поток отката: выбрать завершённый импорт → rollback PREVIEW (что архивируем / откатываем /
 * пропускаем как изменённое вручную / удаляем list-entry) → confirm → статистика.
 * Откат идёт ИЗ ЖУРНАЛА (created/updated), не из CSV. Изменённые вручную после импорта значения/записи
 * по умолчанию ПРОПУСКАЮТСЯ (manual-edit guard); чек-бокс «force» откатывает и их (осознанно).
 */

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, History, Loader2, RotateCcw, CheckCircle2, AlertTriangle, Archive, Undo2, Trash2, ShieldAlert, ListChecks } from 'lucide-react';
import { importsApi, type ImportJobSummary, type RollbackPreview, type RollbackStats } from '@/lib/api';

interface Props { objectId?: string; onClose: () => void; onRolledBack?: () => void }

const STATUS_TONE: Record<string, string> = {
  COMPLETED: 'bg-emerald-100 text-emerald-700', COMPLETED_WITH_ERRORS: 'bg-amber-100 text-amber-700',
  FAILED: 'bg-rose-100 text-rose-700', RUNNING: 'bg-sky-100 text-sky-700', CANCELED: 'bg-surface-2 text-ink-muted',
  READY: 'bg-violet-100 text-violet-700', MAPPING_REQUIRED: 'bg-surface-2 text-ink-muted', UPLOADED: 'bg-surface-2 text-ink-muted',
};
const fmtDate = (s: string) => { try { return new Date(s).toLocaleString(); } catch { return s; } };
const isRollbackable = (j: ImportJobSummary) => (j.status === 'COMPLETED' || j.status === 'COMPLETED_WITH_ERRORS') && !j.rolledBackAt;

export default function ImportHistoryModal({ objectId, onClose, onRolledBack }: Props) {
  const [jobs, setJobs] = useState<ImportJobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // активный откат: выбранный job + его preview + force + результат
  const [target, setTarget] = useState<ImportJobSummary | null>(null);
  const [preview, setPreview] = useState<RollbackPreview | null>(null);
  const [force, setForce] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<RollbackStats | null>(null);

  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose]);

  const load = useCallback(() => {
    setLoading(true); setError('');
    importsApi.list(objectId).then((list) => setJobs(list)).catch((e) => setError(e?.response?.data?.error ?? 'Failed to load import history')).finally(() => setLoading(false));
  }, [objectId]);
  useEffect(() => { load(); }, [load]);

  // открыть preview отката для выбранного импорта (с учётом force)
  const openRollback = useCallback((job: ImportJobSummary, nextForce: boolean) => {
    setTarget(job); setStats(null); setBusy(true); setError('');
    importsApi.rollbackPreview(job.id, nextForce)
      .then((p) => setPreview(p))
      .catch((e) => { setError(e?.response?.data?.error ?? 'Rollback preview failed'); setTarget(null); })
      .finally(() => setBusy(false));
  }, []);

  const toggleForce = (next: boolean) => { setForce(next); if (target) openRollback(target, next); };

  const confirmRollback = useCallback(() => {
    if (!target) return;
    setBusy(true); setError('');
    importsApi.rollback(target.id, force)
      .then((s) => { setStats(s); onRolledBack?.(); load(); })
      .catch((e) => setError(e?.response?.data?.error ?? 'Rollback failed'))
      .finally(() => setBusy(false));
  }, [target, force, onRolledBack, load]);

  const closeRollback = () => { setTarget(null); setPreview(null); setForce(false); setStats(null); setError(''); };

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }}
          onClick={(e) => e.stopPropagation()}
          className="flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
        >
          <header className="flex shrink-0 items-center gap-2.5 border-b border-line px-5 py-3.5">
            <span className="brand-gradient flex h-8 w-8 items-center justify-center rounded-lg text-white"><History size={16} /></span>
            <div className="min-w-0">
              <h2 className="text-[14px] font-bold text-ink">Import history</h2>
              <p className="text-[11.5px] text-ink-subtle">Review past imports · roll one back from its journal</p>
            </div>
            <button type="button" onClick={onClose} className="ml-auto rounded-lg p-1.5 text-ink-subtle hover:bg-surface-2 hover:text-ink"><X size={16} /></button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {error && !target && <div className="mb-3 flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700"><AlertTriangle size={14} /> {error}</div>}

            {/* ── Панель отката (preview → confirm) ── */}
            {target ? (
              <div className="rounded-xl border border-line bg-surface-2/40 p-4">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={closeRollback} className="rounded-md px-1.5 py-0.5 text-[12px] font-semibold text-ink-muted hover:bg-surface-2 hover:text-ink">← Back</button>
                  <span className="text-[13px] font-bold text-ink">Roll back “{target.fileName}”</span>
                </div>

                {busy && !stats ? (
                  <div className="flex items-center gap-2 py-8 text-[13px] text-ink-subtle"><Loader2 size={16} className="animate-spin" /> Computing rollback plan…</div>
                ) : stats ? (
                  // ── Результат отката ──
                  <div className="mt-3">
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-[13px] font-semibold text-emerald-700"><CheckCircle2 size={16} /> Rollback complete</div>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <Stat label="Records archived" value={stats.archived} icon={<Archive size={13} />} tone="text-rose-600" />
                      <Stat label="Values reverted" value={stats.reverted} icon={<Undo2 size={13} />} tone="text-sky-600" />
                      <Stat label="Values deleted" value={stats.valuesDeleted} icon={<Trash2 size={13} />} tone="text-rose-600" />
                      <Stat label="List entries removed" value={stats.listEntriesDeleted} icon={<ListChecks size={13} />} tone="text-violet-600" />
                      <Stat label="Skipped (manual edit)" value={stats.skippedManual} icon={<ShieldAlert size={13} />} tone="text-amber-600" />
                      <Stat label="Errors" value={stats.errors} icon={<AlertTriangle size={13} />} tone={stats.errors ? 'text-rose-600' : 'text-ink-subtle'} />
                    </div>
                    <button type="button" onClick={closeRollback} className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 text-[12.5px] font-semibold text-white hover:bg-brand-700">Done</button>
                  </div>
                ) : preview ? (
                  // ── Preview: что произойдёт ДО выполнения ──
                  <div className="mt-3">
                    {preview.alreadyRolledBack && <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-700"><AlertTriangle size={14} /> This import was already rolled back.</div>}
                    {error && <div className="mb-3 flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700"><AlertTriangle size={14} /> {error}</div>}
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <Stat label="Records → archive" value={preview.recordsToArchive} icon={<Archive size={13} />} tone="text-rose-600" />
                      <Stat label="Values → revert" value={preview.valuesToRevert} icon={<Undo2 size={13} />} tone="text-sky-600" />
                      <Stat label="List entries → remove" value={preview.listEntriesToDelete} icon={<ListChecks size={13} />} tone="text-violet-600" />
                      <Stat label="Records skipped (manual)" value={preview.recordsSkippedManual} icon={<ShieldAlert size={13} />} tone="text-amber-600" />
                      <Stat label="Values skipped (manual)" value={preview.valuesSkippedManual} icon={<ShieldAlert size={13} />} tone="text-amber-600" />
                    </div>

                    {(preview.recordsSkippedManual > 0 || preview.valuesSkippedManual > 0) && (
                      <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2.5">
                        <input type="checkbox" checked={force} onChange={(e) => toggleForce(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 rounded border-line text-amber-600 focus:ring-amber-300" />
                        <span className="text-[11.5px] text-amber-800">
                          <span className="font-bold">Force rollback manually-edited data too.</span> By default, records or values edited after the import are kept untouched. Check this to overwrite/archive them anyway.
                        </span>
                      </label>
                    )}

                    <div className="mt-4 flex items-center gap-2">
                      <button
                        type="button"
                        disabled={busy || preview.alreadyRolledBack || (preview.recordsToArchive + preview.valuesToRevert + preview.listEntriesToDelete === 0)}
                        onClick={confirmRollback}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 text-[12.5px] font-semibold text-white shadow-xs transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busy ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />} Confirm rollback
                      </button>
                      <button type="button" onClick={closeRollback} className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3.5 text-[12.5px] font-semibold text-ink-muted hover:bg-surface-2">Cancel</button>
                      {preview.recordsToArchive + preview.valuesToRevert + preview.listEntriesToDelete === 0 && !preview.alreadyRolledBack && (
                        <span className="text-[11px] text-ink-subtle">Nothing to roll back{(preview.recordsSkippedManual || preview.valuesSkippedManual) ? ' — all changes were edited manually' : ''}.</span>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : loading ? (
              <div className="flex items-center gap-2 py-10 text-[13px] text-ink-subtle"><Loader2 size={16} className="animate-spin" /> Loading import history…</div>
            ) : jobs.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-ink-subtle"><History size={26} /><p className="text-[13px]">No imports yet for this object.</p></div>
            ) : (
              <div className="space-y-2">
                {jobs.map((j) => (
                  <div key={j.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-muted">{j.targetType === 'LIST' ? <ListChecks size={15} /> : <History size={15} />}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[12.5px] font-bold text-ink">{j.fileName}</p>
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${STATUS_TONE[j.status] ?? 'bg-surface-2 text-ink-muted'}`}>{j.status.replace(/_/g, ' ')}</span>
                        {j.targetType === 'LIST' && <span className="shrink-0 rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">list</span>}
                        {j.rolledBackAt && <span className="shrink-0 rounded bg-ink/10 px-1.5 py-0.5 text-[10px] font-bold text-ink-muted">rolled back</span>}
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-ink-subtle">
                        {fmtDate(j.createdAt)} · +{j.createdCount} created · {j.updatedCount} updated · {j.skippedCount} skipped{j.errorCount ? ` · ${j.errorCount} errors` : ''}
                        {j.rolledBackAt && j.rollbackStats && ` · ↩ archived ${j.rollbackStats.archived}, reverted ${j.rollbackStats.reverted}`}
                      </p>
                    </div>
                    {isRollbackable(j) ? (
                      <button type="button" onClick={() => { setForce(false); openRollback(j, false); }} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-[11.5px] font-semibold text-rose-700 transition-colors hover:bg-rose-100"><RotateCcw size={13} /> Roll back</button>
                    ) : (
                      <span className="shrink-0 text-[11px] text-ink-subtle">{j.rolledBackAt ? 'reverted' : '—'}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Stat({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-2.5 py-2">
      <span className={`inline-flex items-center gap-1 text-[16px] font-extrabold ${tone}`}>{icon} {value}</span>
      <p className="mt-0.5 text-[9.5px] font-medium uppercase tracking-[0.03em] text-ink-subtle">{label}</p>
    </div>
  );
}
