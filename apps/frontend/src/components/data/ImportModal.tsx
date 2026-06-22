'use client';

/**
 * ImportModal — импорт записей CRM из CSV через job-flow (M20-1, S330–S338).
 * Поток: upload (parse CSV) → create job → mapping (атрибут/relationship/required/dedupe) →
 * server-side PREVIEW (detected types + per-row valid/warning/error + estimate) → confirm → result.
 * Единый серверный планировщик: preview == confirm plan. Старый one-shot не используется здесь.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Upload, X, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle, ArrowRight, Link2 } from 'lucide-react';
import {
  importsApi, type ImportJobSummary, type ImportMapping, type ImportPreview,
} from '@/lib/api';
import type { CrmAttribute, ImportResult } from '@/lib/crmApi';

const SKIP = '__skip__';

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const rows: string[][] = [];
  let field = ''; let row: string[] = []; let inQuotes = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (inQuotes) { if (c === '"') { if (src[i + 1] === '"') { field += '"'; i += 1; } else inQuotes = false; } else field += c; }
    else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && src[i + 1] === '\n') i += 1; row.push(field); field = ''; if (row.some((x) => x !== '')) rows.push(row); row = []; }
    else field += c;
  }
  if (field !== '' || row.length) { row.push(field); if (row.some((x) => x !== '')) rows.push(row); }
  if (rows.length === 0) return { headers: [], rows: [] };
  const headers = rows[0].map((h) => h.trim());
  const dataRows = rows.slice(1).map((r) => { const obj: Record<string, string> = {}; headers.forEach((h, idx) => { obj[h] = (r[idx] ?? '').trim(); }); return obj; });
  return { headers, rows: dataRows };
}

interface ImportModalProps { objectKey: string; objectLabel: string; attrs: CrmAttribute[]; onClose: () => void; onImported: (result: ImportResult) => void }

const TYPE_TONE: Record<string, string> = { create: 'bg-emerald-100 text-emerald-700', update: 'bg-sky-100 text-sky-700', skip: 'bg-surface-2 text-ink-muted', error: 'bg-rose-100 text-rose-700' };

export default function ImportModal({ objectKey, objectLabel, attrs, onClose, onImported }: ImportModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cidRef = useRef<string>((typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : `imp-${Date.now()}`);
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'result'>('upload');
  const [fileName, setFileName] = useState('');
  const [job, setJob] = useState<ImportJobSummary | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [dedupeKey, setDedupeKey] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number; errorCount: number } | null>(null);

  const mappable = useMemo(() => attrs.filter((a) => a.key !== 'agent_stage'), [attrs]);
  const attrType = useMemo(() => new Map(attrs.map((a) => [a.key, a.type])), [attrs]);

  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose]);

  async function handleFile(file: File) {
    setError('');
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.headers.length === 0 || parsed.rows.length === 0) { setError('Could not parse CSV — make sure it has a header and rows.'); return; }
    setFileName(file.name);
    setBusy(true);
    try {
      const res = await importsApi.create({ objectKey, fileName: file.name, headers: parsed.headers, rows: parsed.rows, clientRequestId: cidRef.current });
      setJob(res.job); setHeaders(res.headers); setMapping(res.mapping || {});
      const mk = new Set(Object.values(res.mapping || {}).map((m) => m.attributeKey));
      setDedupeKey(['domain', 'email', 'work_email'].find((k) => mk.has(k)) ?? '');
      setStep('mapping');
    } catch (e) { setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Upload failed'); }
    finally { setBusy(false); }
  }

  const setCol = (h: string, attributeKey: string) => setMapping((m) => { const next = { ...m }; if (attributeKey === SKIP) delete next[h]; else next[h] = { ...(next[h] ?? {}), attributeKey, asRelationship: attrType.get(attributeKey) === 'RELATIONSHIP' ? next[h]?.asRelationship ?? true : undefined }; return next; });
  const toggleRel = (h: string) => setMapping((m) => ({ ...m, [h]: { ...m[h], asRelationship: !m[h]?.asRelationship } }));
  const mappedHeaders = headers.filter((h) => mapping[h]?.attributeKey);

  async function goPreview() {
    if (!job) return;
    setBusy(true); setError('');
    try {
      await importsApi.saveMapping(job.id, mapping, dedupeKey || null);
      const pv = await importsApi.preview(job.id, { mapping, dedupeKey: dedupeKey || null });
      setPreview(pv); setStep('preview');
    } catch (e) { setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Preview failed'); }
    finally { setBusy(false); }
  }

  async function confirm() {
    if (!job) return;
    setBusy(true); setError('');
    try {
      const r = await importsApi.confirm(job.id);
      setResult(r); setStep('result');
    } catch (e) { setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Import failed'); }
    finally { setBusy(false); }
  }

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-[70] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
        <motion.div className="relative flex max-h-[88vh] w-full max-w-[760px] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
          initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }} transition={{ type: 'spring', stiffness: 440, damping: 34 }}>
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-brand-600"><Upload size={16} /></span>
              <div>
                <h2 className="text-[15px] font-bold text-ink">Import into {objectLabel}</h2>
                <p className="text-[12px] text-ink-muted">{step === 'upload' ? 'Upload CSV' : step === 'mapping' ? 'Map columns' : step === 'preview' ? 'Preview & validate' : 'Result'}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-subtle hover:bg-surface-2 hover:text-ink"><X size={16} /></button>
          </div>

          {/* steps indicator */}
          <div className="flex items-center gap-1.5 border-b border-line px-5 py-2 text-[11px]">
            {(['upload', 'mapping', 'preview', 'result'] as const).map((s, i) => (
              <span key={s} className={['rounded-full px-2 py-0.5 font-semibold capitalize', step === s ? 'bg-brand-600 text-white' : (['upload', 'mapping', 'preview', 'result'].indexOf(step) > i ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-2 text-ink-subtle')].join(' ')}>{i + 1}. {s}</span>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {step === 'upload' && (
              <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
                className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line-strong bg-surface-2/40 py-12 text-ink-muted transition-colors hover:border-brand-400 hover:bg-brand-50/40 disabled:opacity-60">
                {busy ? <Loader2 size={28} className="animate-spin text-brand-500" /> : <FileSpreadsheet size={32} className="text-brand-500" />}
                <p className="text-[14px] font-semibold text-ink">Choose a CSV file</p>
                <p className="text-[12px] text-ink-subtle">First row holds the column headers</p>
              </button>
            )}

            {step === 'mapping' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-line bg-surface-2/40 px-3 py-2 text-[12px]">
                  <span className="inline-flex items-center gap-1.5 text-ink"><FileSpreadsheet size={13} className="text-brand-500" /> {fileName} · {job?.rowCount} rows</span>
                  <button type="button" onClick={() => { cidRef.current = (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : `imp-${Date.now()}`; setStep('upload'); setJob(null); setHeaders([]); }} className="text-brand-700 hover:underline">Change file</button>
                </div>
                <div>
                  <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-ink-subtle">Map columns → attributes</p>
                  <div className="space-y-1.5">
                    {headers.map((h) => {
                      const m = mapping[h];
                      const isRel = m && attrType.get(m.attributeKey) === 'RELATIONSHIP';
                      return (
                        <div key={h} className="flex items-center gap-2">
                          <span className="w-[34%] truncate rounded-md bg-surface-2 px-2 py-1.5 text-[12px] font-medium text-ink" title={h}>{h}</span>
                          <ArrowRight size={13} className="shrink-0 text-ink-subtle" />
                          <select value={m?.attributeKey ?? SKIP} onChange={(e) => setCol(h, e.target.value)} className="h-8 flex-1 rounded-md border border-line-strong bg-surface px-2 text-[12px] text-ink focus:border-brand-500 focus:outline-none">
                            <option value={SKIP}>— don’t import —</option>
                            {mappable.map((a) => <option key={a.key} value={a.key}>{a.name} ({a.key}){(a as { isRequired?: boolean }).isRequired ? ' *' : ''}</option>)}
                          </select>
                          {isRel && (
                            <button type="button" onClick={() => toggleRel(h)} title="Match this column to related records by name" className={['inline-flex h-8 items-center gap-1 rounded-md border px-2 text-[10.5px] font-semibold', m?.asRelationship ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-line text-ink-muted'].join(' ')}>
                              <Link2 size={11} /> link
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-ink-subtle">Dedupe by</span>
                  <select value={dedupeKey} onChange={(e) => setDedupeKey(e.target.value)} className="h-8 rounded-md border border-line-strong bg-surface px-2 text-[12px] text-ink focus:border-brand-500 focus:outline-none">
                    <option value="">— no dedupe (create all) —</option>
                    {[...new Set(mappedHeaders.map((h) => mapping[h].attributeKey))].map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                  <span className="text-[11px] text-ink-subtle">match → update, otherwise create</span>
                </div>
              </div>
            )}

            {step === 'preview' && preview && (
              <div className="space-y-3">
                {/* estimate */}
                <div className="grid grid-cols-4 gap-2">
                  {([['Create', preview.estimate.created, 'text-emerald-600'], ['Update', preview.estimate.updated, 'text-sky-600'], ['Skip', preview.estimate.skipped, 'text-ink-muted'], ['Errors', preview.estimate.errors, 'text-rose-600']] as const).map(([l, v, c]) => (
                    <div key={l} className="rounded-lg border border-line bg-surface px-3 py-2 text-center"><p className="text-[10px] font-semibold uppercase text-ink-subtle">{l}</p><p className={`text-[18px] font-extrabold ${c}`}>{v}</p></div>
                  ))}
                </div>
                {/* detected types */}
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(preview.detectedTypes).filter(([h]) => mappedHeaders.includes(h)).map(([h, t]) => (
                    <span key={h} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10.5px] text-ink-muted"><b className="text-ink">{h}</b> · {t}</span>
                  ))}
                </div>
                {preview.warnings.length > 0 && preview.warnings.map((w, i) => <p key={i} className="flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-700"><AlertTriangle size={11} /> {w}</p>)}
                {/* per-row preview */}
                <div className="overflow-x-auto rounded-lg border border-line">
                  <table className="w-full text-left text-[11.5px]">
                    <thead className="bg-surface-2/60"><tr><th className="px-2 py-1.5 font-semibold text-ink-muted">Row</th><th className="px-2 py-1.5 font-semibold text-ink-muted">Status</th><th className="px-2 py-1.5 font-semibold text-ink-muted">Details</th></tr></thead>
                    <tbody>
                      {preview.rows.map((r) => (
                        <tr key={r.row} className="border-t border-line">
                          <td className="px-2 py-1 tabular-nums text-ink-subtle">{r.row}</td>
                          <td className="px-2 py-1"><span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${TYPE_TONE[r.action]}`}>{r.action}</span></td>
                          <td className="px-2 py-1 text-ink-muted">{r.errors.length ? <span className="text-rose-600">{r.errors.join('; ')}</span> : r.warnings.length ? <span className="text-amber-600">{r.warnings.join('; ')}</span> : Object.entries(r.values).slice(0, 3).map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10.5px] text-ink-subtle">Showing {preview.rows.length} of {preview.totalRows ?? preview.rows.length} rows · errors block a row, warnings don’t.</p>
              </div>
            )}

            {step === 'result' && result && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3">
                  <CheckCircle2 size={18} className="text-emerald-600" />
                  <p className="text-[13.5px] font-semibold text-emerald-800">Import complete: created {result.created}, updated {result.updated}, skipped {result.skipped}{result.errorCount ? `, ${result.errorCount} errors` : ''}</p>
                </div>
                <p className="text-[11.5px] text-ink-subtle">Tracked in Import History — you can review row results and (next release) roll it back.</p>
              </div>
            )}

            {error && <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-[12px] text-rose-600">{error}</p>}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
            {step === 'result' ? (
              <button type="button" onClick={() => { onImported({ created: result!.created, updated: result!.updated, skipped: result!.skipped, total: (result!.created + result!.updated + result!.skipped + result!.errorCount), errors: [], dedupeKey: dedupeKey || null }); onClose(); }} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-4 text-[13px] font-semibold text-white hover:bg-brand-700">Done</button>
            ) : (
              <>
                <button type="button" onClick={onClose} className="h-9 rounded-lg px-3 text-[13px] font-medium text-ink-muted hover:bg-surface-2">Cancel</button>
                {step === 'mapping' && <button type="button" disabled={busy || mappedHeaders.length === 0} onClick={goPreview} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-4 text-[13px] font-semibold text-white shadow-brand hover:bg-brand-700 disabled:opacity-60">{busy ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />} Preview</button>}
                {step === 'preview' && (
                  <>
                    <button type="button" onClick={() => setStep('mapping')} className="h-9 rounded-lg px-3 text-[13px] font-medium text-ink-muted hover:bg-surface-2">Back</button>
                    <button type="button" disabled={busy || !preview || (preview.estimate.created + preview.estimate.updated === 0)} onClick={confirm} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-4 text-[13px] font-semibold text-white shadow-brand hover:bg-brand-700 disabled:opacity-60">{busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Import {preview ? preview.estimate.created + preview.estimate.updated : ''}</button>
                  </>
                )}
              </>
            )}
          </div>

          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
