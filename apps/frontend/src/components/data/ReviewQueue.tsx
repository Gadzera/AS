'use client';

/**
 * ReviewQueue — очередь ревью низкоуверенных AI-значений (M9.3, согласовано с GPT).
 * Источник — реальные AI-значения с companion-confidence ниже порога.
 * Действия (персист в БД + Activity-аудит):
 *   Approve — значение принято, уходит из очереди;
 *   Reject  — значение отклонено (очищается/помечается rejected), уходит из очереди;
 *   Edit    — ручное значение вместо AI, уходит из очереди.
 * RBAC: смотреть может любой; approve/reject/edit — не для MEMBER (View-only).
 */

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Loader2, ScanEye, Check, Ban, Pencil, AlertTriangle, CheckCircle2, Hash } from 'lucide-react';
import {
  listAiReviewQueue,
  approveAiReview,
  rejectAiReview,
  editAiReview,
  type AiReviewItem,
} from '@/lib/crmApi';

interface Props {
  open: boolean;
  onClose: () => void;
  objectKey: string;
  canManage: boolean;
  onChanged: () => void;
}

const keyOf = (i: AiReviewItem) => `${i.recordId}:${i.attributeKey}`;

function confColor(c: number | null): string {
  if (c == null) return 'text-ink-subtle';
  if (c < 40) return 'text-rose-600';
  if (c < 60) return 'text-amber-600';
  return 'text-emerald-600';
}

export default function ReviewQueue({ open, onClose, objectKey, canManage, onChanged }: Props) {
  const [items, setItems] = useState<AiReviewItem[]>([]);
  const [threshold, setThreshold] = useState(60);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);          // ключ элемента в работе
  const [editing, setEditing] = useState<string | null>(null);    // ключ редактируемого
  const [editValue, setEditValue] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await listAiReviewQueue(objectKey);
      setItems(r.items);
      setThreshold(r.threshold);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Failed to load review queue');
    } finally {
      setLoading(false);
    }
  }, [objectKey]);

  useEffect(() => { if (open) { setEditing(null); load(); } }, [open, load]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, busy]);

  const removeLocal = (k: string) => setItems((prev) => prev.filter((i) => keyOf(i) !== k));

  async function act(item: AiReviewItem, kind: 'approve' | 'reject' | 'edit', value?: string) {
    const k = keyOf(item);
    setBusy(k);
    try {
      if (kind === 'approve') await approveAiReview(item.recordId, item.attributeKey);
      else if (kind === 'reject') await rejectAiReview(item.recordId, item.attributeKey);
      else await editAiReview(item.recordId, item.attributeKey, value ?? '');
      removeLocal(k);
      setEditing(null);
      onChanged();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Action failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => { if (!busy) onClose(); }}
        >
          <motion.div
            className="flex max-h-[82vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
            initial={{ scale: 0.97, opacity: 0, y: 8 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.97, opacity: 0, y: 8 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* header */}
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><ScanEye size={15} /></span>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-ink">Review AI fields</p>
                <p className="text-[11px] text-ink-subtle">Low-confidence AI values (&lt; {threshold}%) — approve, reject or edit</p>
              </div>
              <span className="ml-auto rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-600 ring-1 ring-inset ring-rose-200">{items.length} to review</span>
              <button type="button" onClick={() => { if (!busy) onClose(); }} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-muted hover:bg-surface-2"><X size={15} /></button>
            </div>

            {!canManage && (
              <div className="flex items-center gap-2 border-b border-line bg-amber-50 px-4 py-2 text-[11.5px] font-semibold text-amber-700">
                <AlertTriangle size={13} /> View-only · members can view the review queue but can’t approve/reject/edit
              </div>
            )}

            {/* body */}
            <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
              {loading ? (
                <div className="flex h-40 items-center justify-center gap-2 text-[13px] text-ink-subtle"><Loader2 size={16} className="animate-spin" /> Loading review queue…</div>
              ) : error ? (
                <div className="flex h-40 flex-col items-center justify-center gap-2 text-[13px] text-rose-600"><AlertTriangle size={18} /> {error}<button type="button" onClick={load} className="mt-1 rounded-md border border-line px-2 py-1 text-[12px] font-semibold text-ink-muted hover:bg-surface-2">Retry</button></div>
              ) : items.length === 0 ? (
                <div className="flex h-40 flex-col items-center justify-center gap-2 text-ink-subtle">
                  <CheckCircle2 size={26} className="text-emerald-500" />
                  <p className="text-[13px] font-semibold text-ink">Nothing to review</p>
                  <p className="text-[11.5px]">All AI values are above the {threshold}% confidence threshold.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((item) => {
                    const k = keyOf(item);
                    const isBusy = busy === k;
                    const isEditing = editing === k;
                    return (
                      <div key={k} className="rounded-xl border border-line bg-surface p-3" data-review-item={k}>
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-[12.5px] font-bold text-ink">{item.recordName}</span>
                              <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-muted">{item.attributeName}</span>
                              {item.lastRunId && <span className="inline-flex items-center gap-0.5 text-[10px] text-ink-subtle" title="last AI run"><Hash size={9} /> {item.lastRunId.slice(-6)}</span>}
                            </div>
                            <div className="mt-1 flex items-center gap-2">
                              <span className="text-[12px] text-ink-muted">AI value: <span className="font-semibold text-ink">{item.aiValue ?? '—'}</span></span>
                              <span className={`text-[11px] font-bold ${confColor(item.confidence)}`}>{item.confidence != null ? `${item.confidence}% conf` : 'no conf'}</span>
                            </div>
                            {isEditing && (
                              <div className="mt-2 flex items-center gap-1.5">
                                <input
                                  autoFocus
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  placeholder="Correct value…"
                                  className="h-8 flex-1 rounded-lg border border-brand-300 bg-surface px-2.5 text-[12.5px] text-ink focus:outline-none focus:ring-2 focus:ring-brand-100"
                                />
                                <button type="button" disabled={isBusy || !editValue.trim()} onClick={() => act(item, 'edit', editValue.trim())} className="inline-flex h-8 items-center gap-1 rounded-lg bg-brand-600 px-2.5 text-[12px] font-semibold text-white hover:bg-brand-700 disabled:opacity-50">{isBusy ? <Loader2 size={13} className="animate-spin" /> : 'Save'}</button>
                                <button type="button" onClick={() => setEditing(null)} className="inline-flex h-8 items-center rounded-lg border border-line px-2 text-[12px] font-semibold text-ink-muted hover:bg-surface-2">Cancel</button>
                              </div>
                            )}
                          </div>

                          {canManage && !isEditing && (
                            <div className="flex shrink-0 items-center gap-1">
                              <button type="button" disabled={isBusy} onClick={() => act(item, 'approve')} title="Approve AI value" className="inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 text-[11.5px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">{isBusy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Approve</button>
                              <button type="button" disabled={isBusy} onClick={() => { setEditing(k); setEditValue(item.aiValue ?? ''); }} title="Edit value manually" className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-surface px-2 text-[11.5px] font-semibold text-ink-muted hover:bg-surface-2 disabled:opacity-50"><Pencil size={13} /> Edit</button>
                              <button type="button" disabled={isBusy} onClick={() => act(item, 'reject')} title="Reject AI value" className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 text-[11.5px] font-semibold text-rose-600 hover:bg-rose-100 disabled:opacity-50"><Ban size={13} /> Reject</button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
