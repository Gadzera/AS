'use client';

/* ──────────────────────────────────────────────────────────────────────────
   RecordDrawer — slide-over профиля записи (M4). Открывается из Data Hub.
   Показывает: agent-band (ICP + последнее действие), AI-атрибуты с provenance
   и запуском/перезапуском по полю, редактируемые поля, таймлайн активности.
   Все данные живые: getRecord / getRecordActivities / runAiForRecord / updateRecord.
   ────────────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Sparkles,
  FlaskConical,
  Loader2,
  Globe,
  Clock,
  Pencil,
  Check,
  Bot,
  History,
  ChevronDown,
  Link2,
  User as UserIcon,
  Calendar,
  Search,
  Plus,
  Info,
  Coins,
  AlertTriangle,
  Zap,
  Phone,
  Lock,
} from 'lucide-react';
import {
  getRecord,
  updateRecord,
  getRecordActivities,
  runAiForRecord,
  getAiProvenance,
  listRecords,
  getReverseGroups,
  getReverseGroupPage,
  reverseLinkAdd,
  reverseLinkRemove,
  type CrmRecord,
  type CrmAttribute,
  type CrmActivity,
  type CrmRecordValue,
  type AiProvenance,
  type ReverseGroup,
} from '@/lib/crmApi';
import { workflowsApi, callsApi, type Workflow, type Call } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import CommentThread from '@/components/data/CommentThread';

// Типы, редактируемые прямо в карточке (остальные показываем read-only с типовым рендером).
const TEXTUAL = new Set(['TEXT', 'LONG_TEXT', 'NUMBER', 'CURRENCY', 'EMAIL', 'PHONE', 'URL', 'LOCATION']);
const EDIT_INLINE = new Set([...TEXTUAL, 'SELECT', 'BOOLEAN']);
const sourceDot: Record<string, string> = { AI: 'bg-brand-500', web: 'bg-cyan-500', mailbox: 'bg-violet-500', human: 'bg-emerald-500', import: 'bg-ink-subtle' };

// M29-1: честное происхождение текущего значения (из record.valueMeta) — больше не хардкод «всегда AI».
function valueSourceMeta(source: string | undefined): { dot: string; label: string; title: string } {
  switch (source) {
    case 'AI': return { dot: sourceDot.AI, label: 'AI', title: 'source: AI agent' };
    case 'IMPORT': return { dot: sourceDot.import, label: 'Import', title: 'source: imported' };
    case 'SYSTEM': return { dot: sourceDot.mailbox, label: 'System', title: 'source: system/workflow' };
    default: return { dot: sourceDot.human, label: 'Manual', title: 'source: manually edited — protected from silent AI overwrite' };
  }
}

function initials(n: string) { return (n || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase(); }
function asText(v: CrmRecordValue | undefined): string {
  if (v == null) return '';
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
function timeAgo(iso: string): string {
  const d = Date.parse(iso);
  if (isNaN(d)) return '';
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
// M9.8 — мета события аудит-таймлайна (метка + цвет + точка). M25-2: AUTO → «Auto-rerun», SKIPPED-стадия.
function tlMeta(type: string, source?: string | null): { label: string; color: string; dot: string } {
  switch (type) {
    case 'AI_FILLED':
      return source === 'AUTO'
        ? { label: 'Auto-rerun · filled', color: 'text-violet-700', dot: 'bg-violet-500' }
        : { label: 'AI filled', color: 'text-brand-700', dot: 'bg-brand-500' };
    case 'AI_FAILED': return { label: 'AI run failed', color: 'text-rose-600', dot: 'bg-rose-400' };
    case 'AI_SKIPPED': return { label: source === 'AUTO' ? 'Auto-rerun · skipped' : 'AI skipped', color: 'text-amber-700', dot: 'bg-amber-400' };
    case 'REVIEW_APPROVED': return { label: 'Approved', color: 'text-emerald-700', dot: 'bg-emerald-500' };
    case 'REVIEW_REJECTED': return { label: 'Rejected & cleared', color: 'text-rose-600', dot: 'bg-rose-400' };
    case 'REVIEW_EDITED': return { label: 'Edited', color: 'text-brand-700', dot: 'bg-brand-500' };
    default: return { label: type, color: 'text-ink', dot: 'bg-ink-subtle' };
  }
}
// M25-2 — состояние AI-значения для badge: 4 явных стадии review-жизненного цикла.
// 'unknown' — provenance не загрузилась/упала: не понижаем edited/rejected/review до generated.
type AiBadgeState = 'empty' | 'generated' | 'review' | 'reviewed' | 'edited' | 'rejected' | 'unknown';
function deriveBadgeState(p: AiProvenance, hasValue: boolean): AiBadgeState {
  if (p.underReview) return 'review';
  if (p.review) return p.review.status === 'APPROVED' ? 'reviewed' : p.review.status === 'EDITED' ? 'edited' : 'rejected';
  return hasValue ? 'generated' : 'empty';
}
// Метка/цвет/иконка badge по стадии. generated/reviewed/edited/rejected — обязательное различие (GPT M25-2).
function badgeMeta(state: AiBadgeState): { label: string; cls: string; icon: typeof Sparkles } | null {
  switch (state) {
    case 'generated': return { label: 'Generated by AI', cls: 'bg-brand-50 text-brand-700', icon: Sparkles };
    case 'review': return { label: 'AI · under review', cls: 'bg-amber-50 text-amber-700', icon: AlertTriangle };
    case 'reviewed': return { label: 'AI · reviewed', cls: 'bg-emerald-50 text-emerald-700', icon: Check };
    case 'edited': return { label: 'AI · edited', cls: 'bg-violet-50 text-violet-700', icon: Pencil };
    case 'rejected': return { label: 'AI · rejected', cls: 'bg-rose-50 text-rose-600', icon: X };
    case 'unknown': return { label: 'AI', cls: 'bg-surface-2 text-ink-muted', icon: Sparkles };
    default: return null;
  }
}
// M9.8 — не утекаем сырую ошибку провайдера в UI (полный текст остаётся в AiRun.error для аудита).
function humanizeProviderError(err: string): string {
  if (/DeepSeek|Anthropic|authentication|provider|LLM|aborted|timeout|ECONNREFUSED|fetch failed|\b(401|403|429|5\d\d)\b/i.test(err)) return 'AI provider error — please retry';
  if (/Запись не найдена|not found/i.test(err)) return 'Record not found (archived/deleted)';
  return err.length > 60 ? err.slice(0, 60) + '…' : err;
}
// relationship/user/select value → читаемый текст (значение может быть объектом/массивом).
function refText(v: CrmRecordValue | undefined): string {
  if (v == null) return '';
  if (Array.isArray(v)) return v.map((x) => refText(x as CrmRecordValue)).filter(Boolean).join(', ');
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return String(o.displayName ?? o.name ?? o.label ?? o.value ?? o.id ?? '');
  }
  return String(v);
}
function optLabel(a: CrmAttribute, v: CrmRecordValue | undefined): string {
  const opts = [...(a.options ?? []), ...(a.config?.options ?? []), ...(a.config?.choices ?? [])];
  const key = refText(v);
  const found = opts.find((o) => o.key === key || o.value === key || o.label === key || o.name === key);
  return found ? (found.label ?? found.name ?? found.value ?? key) : key;
}
function asBool(v: CrmRecordValue | undefined): boolean {
  return v === true || v === 'true' || v === 1 || v === '1';
}
function fmtDate(v: CrmRecordValue | undefined): string {
  const t = refText(v);
  if (!t) return '';
  const d = new Date(t);
  return isNaN(d.getTime()) ? t : d.toLocaleDateString('en', { year: 'numeric', month: 'short', day: '2-digit' });
}

export default function RecordDrawer({
  recordId,
  attrs,
  onClose,
  onChanged,
}: {
  recordId: string;
  attrs: CrmAttribute[];
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [rec, setRec] = useState<CrmRecord | null>(null);
  const [acts, setActs] = useState<CrmActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Set<string>>(new Set()); // attributeId в процессе AI
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showDossier, setShowDossier] = useState(true);
  // provenance-popover (M9): какой AI-атрибут раскрыт + данные последнего AiRun
  const [provFor, setProvFor] = useState<string | null>(null);
  const [prov, setProv] = useState<AiProvenance | null>(null);
  const [provLoading, setProvLoading] = useState(false);
  // M25-2: review-стадия каждого AI-поля для inline-badge (generated/review/reviewed/edited/rejected)
  const [badgeStates, setBadgeStates] = useState<Record<string, AiBadgeState>>({});

  async function openProvenance(attrId: string) {
    if (provFor === attrId) { setProvFor(null); return; }
    setProvFor(attrId); setProv(null); setProvLoading(true);
    try { setProv(await getAiProvenance(attrId, recordId)); } catch { setProv(null); }
    setProvLoading(false);
  }

  async function load() {
    const [r, a] = await Promise.all([
      getRecord(recordId),
      getRecordActivities(recordId, 1, 30).catch(() => ({ activities: [] as CrmActivity[] })),
    ]);
    setRec(r);
    setActs(a.activities ?? []);
  }

  useEffect(() => {
    let alive = true;
    setLoading(true);
    load().finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId]);

  const values = rec?.values ?? {};
  const name = rec?.displayName || asText(values.name) || 'Record';
  const domain = asText(values.domain).replace(/^https?:\/\//, '').replace(/\/$/, '');

  // M9.8 — provenance показываем для aiEnabled И для reviewable-полей (есть companion *_confidence):
  // у таких полей нет своего AI-run, но есть review-решения, и аудит должен их показывать.
  const reviewBaseKeys = useMemo(() => {
    const CONF = '_confidence';
    const set = new Set<string>();
    for (const a of attrs) {
      if (!a.key.endsWith(CONF)) continue;
      const prefix = a.key.slice(0, -CONF.length);
      const base = attrs.find((b) => b.key === prefix) ?? attrs.find((b) => b.key !== a.key && b.key.startsWith(prefix + '_') && !b.key.endsWith(CONF));
      if (base) set.add(base.key);
    }
    return set;
  }, [attrs]);
  const aiAttrs = useMemo(() => attrs.filter((a) => a.aiEnabled || reviewBaseKeys.has(a.key)), [attrs, reviewBaseKeys]);
  // REL-1: reverse-атрибут (config.reverse) — обратная сторона связи, НЕ редактируемое поле здесь
  // (REL-2 добавит отдельную read-only секцию с резолвом записей). Исключаем из editable fields.
  const fieldAttrs = useMemo(
    () => attrs.filter((a) => !a.aiEnabled && !reviewBaseKeys.has(a.key) && a.key !== 'name' && !(a.config as { reverse?: boolean } | null | undefined)?.reverse),
    [attrs, reviewBaseKeys],
  );

  // M25-2: подтягиваем review-стадию каждого AI-поля (для inline-badge) одним батчем при открытии/обновлении.
  const aiAttrSig = aiAttrs.map((a) => a.id).join(',');
  useEffect(() => {
    if (!rec) return;
    let alive = true;
    const vals = rec.values ?? {};
    Promise.all(
      aiAttrs.map(async (a) => {
        try {
          const p = await getAiProvenance(a.id, recordId);
          return [a.id, deriveBadgeState(p, !!asText(vals[a.key]))] as const;
        } catch {
          // адверс MEDIUM-2: при сбое provenance НЕ заявляем 'generated' (это понизило бы edited/rejected/review).
          return [a.id, (asText(vals[a.key]) ? 'unknown' : 'empty') as AiBadgeState] as const;
        }
      }),
    ).then((entries) => { if (alive) setBadgeStates(Object.fromEntries(entries)); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId, rec, aiAttrSig]);
  const researchAttr = aiAttrs.find((a) => a.aiType === 'RESEARCH');

  const icp = typeof values.icp_fit === 'number' ? values.icp_fit : Number(values.icp_fit) || null;
  const icpConf = typeof values.icp_confidence === 'number' ? values.icp_confidence : Number(values.icp_confidence) || null;
  const fit = icp == null ? null : icp >= 85 ? 'High' : icp >= 60 ? 'Mid' : 'Low';
  const fitTone = fit === 'High' ? 'bg-emerald-50 text-emerald-700' : fit === 'Mid' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-600';

  async function runField(attrId: string, overwrite = false) {
    setBusy((p) => new Set(p).add(attrId));
    try {
      const r = await runAiForRecord({ attributeId: attrId, recordId, source: 'RECORD_PAGE', overwrite });
      // M29-1: значение ручное — спрашиваем подтверждение, при согласии повторяем с overwrite.
      if (r.status === 'CONFLICT') {
        setBusy((p) => { const n = new Set(p); n.delete(attrId); return n; });
        if (typeof window !== 'undefined' && window.confirm('This value was manually edited. Overwrite with AI?')) {
          await runField(attrId, true);
        }
        return;
      }
      await load();
      window.dispatchEvent(new CustomEvent('credits:refresh'));
      onChanged?.();
      // если provenance этого поля открыта — обновим её свежим запуском
      if (provFor === attrId) { try { setProv(await getAiProvenance(attrId, recordId)); } catch { /* no-op */ } }
    } catch { /* no-op */ }
    setBusy((p) => { const n = new Set(p); n.delete(attrId); return n; });
  }

  function selectCurrent(a: CrmAttribute): string {
    const cur = values[a.key];
    if (cur && typeof cur === 'object' && !Array.isArray(cur)) {
      const o = cur as Record<string, unknown>;
      return String(o.value ?? o.key ?? '');
    }
    return refText(cur);
  }
  function currencyAmount(a: CrmAttribute): string {
    const cur = values[a.key];
    if (cur && typeof cur === 'object' && !Array.isArray(cur)) return String((cur as Record<string, unknown>).amount ?? '');
    return asText(cur);
  }

  function startEdit() {
    const d: Record<string, string> = {};
    for (const a of fieldAttrs) {
      if (!EDIT_INLINE.has(a.type)) continue;
      if (a.type === 'BOOLEAN') d[a.key] = asBool(values[a.key]) ? 'true' : 'false';
      else if (a.type === 'SELECT') d[a.key] = selectCurrent(a);
      else if (a.type === 'CURRENCY') d[a.key] = currencyAmount(a);
      else d[a.key] = asText(values[a.key]);
    }
    setDraft(d);
    setEdit(true);
  }

  async function save() {
    setSaving(true);
    const patch: Record<string, CrmRecordValue> = {};
    for (const a of fieldAttrs) {
      if (!EDIT_INLINE.has(a.type)) continue;
      const next = draft[a.key] ?? '';
      if (a.type === 'BOOLEAN') {
        const b = next === 'true';
        if (b !== asBool(values[a.key])) patch[a.key] = b;
      } else if (a.type === 'SELECT') {
        if (next !== selectCurrent(a)) patch[a.key] = next === '' ? null : next;
      } else if (a.type === 'CURRENCY') {
        if (next !== currencyAmount(a)) patch[a.key] = next === '' ? null : Number(next);
      } else if (a.type === 'NUMBER') {
        if (next !== asText(values[a.key])) patch[a.key] = next === '' ? null : Number(next);
      } else {
        if (next !== asText(values[a.key])) patch[a.key] = next === '' ? null : next;
      }
    }
    try {
      if (Object.keys(patch).length) {
        await updateRecord(recordId, patch);
        await load();
        onChanged?.();
      }
      setEdit(false);
    } catch { /* no-op */ }
    setSaving(false);
  }

  // Типовой рендер значения поля (view-режим).
  function display(a: CrmAttribute) {
    const v = values[a.key];
    if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) return <span className="text-ink-subtle">—</span>;
    switch (a.type) {
      case 'SELECT':
        return <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11.5px] font-medium text-ink-muted">{optLabel(a, v)}</span>;
      case 'MULTI_SELECT': {
        const arr = Array.isArray(v) ? v : [v];
        return <div className="flex flex-wrap gap-1">{arr.map((x, i) => <span key={i} className="rounded bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-700">{optLabel(a, x as CrmRecordValue)}</span>)}</div>;
      }
      case 'RELATIONSHIP': {
        const t = refText(v);
        return t ? <span className="inline-flex items-center gap-1 rounded bg-surface-2 px-1.5 py-0.5 text-[12px] text-ink"><Link2 size={11} className="text-brand-600" />{t}</span> : <span className="text-ink-subtle">—</span>;
      }
      case 'USER': {
        const t = refText(v);
        return t ? <span className="inline-flex items-center gap-1 text-[12px] text-ink"><UserIcon size={11} className="text-brand-600" />{t}</span> : <span className="text-ink-subtle">—</span>;
      }
      case 'BOOLEAN':
        return <span className={asBool(v) ? 'font-medium text-emerald-700' : 'text-ink-subtle'}>{asBool(v) ? 'Yes' : 'No'}</span>;
      case 'DATE':
      case 'DATETIME':
        return <span className="inline-flex items-center gap-1 text-ink"><Calendar size={11} className="text-ink-subtle" />{fmtDate(v)}</span>;
      case 'URL': {
        const u = asText(v);
        return <a href={/^https?:/.test(u) ? u : 'https://' + u} target="_blank" rel="noreferrer" className="truncate text-brand-700 hover:underline">{u.replace(/^https?:\/\//, '')}</a>;
      }
      case 'EMAIL': {
        const e = asText(v);
        return <a href={'mailto:' + e} className="truncate text-brand-700 hover:underline">{e}</a>;
      }
      case 'CURRENCY': {
        const obj = v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
        const amt = Number(obj ? obj.amount : v);
        const cc = String(obj?.currencyCode ?? 'USD');
        return <span className="font-medium text-ink">{isNaN(amt) ? asText(v) : new Intl.NumberFormat('en', { style: 'currency', currency: cc, maximumFractionDigits: 0 }).format(amt)}</span>;
      }
      case 'JSON':
        return <code className="block truncate text-[11px] text-ink-muted">{asText(v).slice(0, 64)}</code>;
      default:
        return <span className="text-ink">{asText(v)}</span>;
    }
  }

  // Редактор поля (edit-режим, только EDIT_INLINE-типы).
  function editor(a: CrmAttribute) {
    if (a.type === 'BOOLEAN') {
      return (
        <label className="inline-flex items-center gap-1.5">
          <input type="checkbox" checked={draft[a.key] === 'true'} onChange={(e) => setDraft((d) => ({ ...d, [a.key]: e.target.checked ? 'true' : 'false' }))} className="h-3.5 w-3.5 rounded border-line text-brand-600" />
          <span className="text-[12px] text-ink">{draft[a.key] === 'true' ? 'Yes' : 'No'}</span>
        </label>
      );
    }
    if (a.type === 'SELECT') {
      const opts = [...(a.options ?? []), ...(a.config?.options ?? []), ...(a.config?.choices ?? [])];
      return (
        <select value={draft[a.key] ?? ''} onChange={(e) => setDraft((d) => ({ ...d, [a.key]: e.target.value }))} className="h-7 w-full rounded-md border border-line bg-surface px-2 text-[12px] text-ink outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100">
          <option value="">—</option>
          {opts.map((o, i) => <option key={o.key ?? o.value ?? i} value={String(o.value ?? o.key)}>{o.label ?? o.name ?? o.value}</option>)}
        </select>
      );
    }
    return (
      <input
        value={draft[a.key] ?? ''}
        onChange={(e) => setDraft((d) => ({ ...d, [a.key]: e.target.value }))}
        inputMode={a.type === 'NUMBER' || a.type === 'CURRENCY' ? 'numeric' : 'text'}
        className="h-7 w-full rounded-md border border-line bg-surface px-2 text-[12px] text-ink outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
      />
    );
  }

  return (
    <>
      <motion.div
        className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.aside
        className="fixed right-0 top-0 z-50 flex h-screen w-[540px] max-w-[94vw] flex-col border-l border-line bg-surface shadow-2xl"
        initial={{ x: 560 }}
        animate={{ x: 0 }}
        exit={{ x: 560 }}
        transition={{ type: 'spring', stiffness: 420, damping: 40 }}
      >
        {/* header */}
        <div className="flex shrink-0 items-start gap-3 border-b border-line px-5 py-4">
          <span className="brand-gradient flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[14px] font-bold text-white shadow-brand ring-1 ring-white/40">{initials(name)}</span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[16px] font-bold tracking-tight text-ink">{name}</h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11.5px] text-ink-subtle">
              {domain && <span className="inline-flex items-center gap-1"><Globe size={11} /> {domain}</span>}
              {asText(values.segment) && <span className="rounded bg-surface-2 px-1.5 py-0.5 font-medium text-ink-muted">{asText(values.segment)}</span>}
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-ink-subtle hover:bg-surface-2 hover:text-ink"><X size={18} /></button>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-[13px] text-ink-subtle"><Loader2 size={16} className="animate-spin" /> Loading…</div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {/* agent band */}
            <div className="rounded-xl border border-line bg-gradient-to-br from-brand-50/70 to-surface p-3.5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-700"><Bot size={13} /> Agent status</span>
                <div className="flex items-center gap-1.5">
                  {/* M17-5: запуск published record-workflow прямо из карточки */}
                  <RunWorkflowButton recordId={recordId} />
                  {researchAttr && (
                    <button
                      type="button"
                      disabled={busy.has(researchAttr.id)}
                      onClick={() => runField(researchAttr.id)}
                      title={`Runs the “${researchAttr.name}” AI field for this record`}
                      className="inline-flex h-7 items-center gap-1.5 rounded-md bg-brand-600 px-2.5 text-[11.5px] font-semibold text-white shadow-xs hover:bg-brand-700 disabled:opacity-60"
                    >
                      {busy.has(researchAttr.id) ? <Loader2 size={12} className="animate-spin" /> : <FlaskConical size={12} />}
                      {busy.has(researchAttr.id) ? 'Researching…' : 'Run research'}
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-2.5 flex items-center gap-4">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-ink-subtle">ICP fit</p>
                  {fit ? (
                    <span className="mt-1 inline-flex items-center gap-1.5">
                      <span className={`rounded px-1.5 py-0.5 text-[12px] font-bold ${fitTone}`}>{fit} · {icp}</span>
                      {icpConf != null && <span className="text-[10px] font-bold text-ink-subtle">{icpConf}% conf</span>}
                    </span>
                  ) : <p className="mt-1 text-[12px] text-ink-subtle">— not scored</p>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-ink-subtle">Last agent action</p>
                  <p className="mt-1 truncate text-[12px] font-medium text-ink">{asText(values.last_agent_action) || '—'}</p>
                </div>
              </div>
            </div>

            {/* AI attributes & provenance */}
            {aiAttrs.length > 0 && (
              <section className="mt-5">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-ink-subtle">AI attributes & provenance</p>
                <div className="space-y-2">
                  {aiAttrs.map((a) => {
                    const raw = asText(values[a.key]);
                    const isDossier = a.aiType === 'RESEARCH';
                    const bState = badgeStates[a.id] ?? (raw ? 'generated' : 'empty');
                    const bMeta = badgeMeta(bState);
                    const BIcon = bMeta?.icon;
                    return (
                      <div key={a.id} className="rounded-lg border border-line bg-surface p-2.5">
                        <div className="flex items-center gap-2">
                          <Sparkles size={12} className="text-brand-500" />
                          <span className="text-[12px] font-semibold text-ink">{a.name}</span>
                          <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand-700">{a.aiType ?? 'REVIEWED'}</span>
                          <span className="ml-auto inline-flex items-center gap-1">
                            {(() => {
                              const sm = valueSourceMeta(rec?.valueMeta?.[a.key]?.source);
                              return (
                                <span className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-ink-subtle" title={sm.title}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${sm.dot}`} /> {sm.label}
                                </span>
                              );
                            })()}
                            <button
                              type="button"
                              onClick={() => openProvenance(a.id)}
                              title="Provenance — full AI audit timeline"
                              className={`inline-flex h-6 items-center gap-1 rounded-md border px-1.5 text-[10.5px] font-semibold transition-colors ${provFor === a.id ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-line bg-surface text-ink-muted hover:bg-surface-2'}`}
                            >
                              <Info size={11} /> Provenance
                            </button>
                            {a.aiEnabled && (
                              <button
                                type="button"
                                disabled={busy.has(a.id)}
                                onClick={() => runField(a.id)}
                                className="inline-flex h-6 items-center gap-1 rounded-md border border-line bg-surface px-1.5 text-[10.5px] font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-60"
                              >
                                {busy.has(a.id) ? <Loader2 size={10} className="animate-spin" /> : raw ? 'Re-run' : 'Run'}
                              </button>
                            )}
                          </span>
                        </div>

                        {/* M25-2: заполненное AI-значение + state-aware badge (generated/review/reviewed/edited/rejected) */}
                        {raw ? (
                          <div className="mt-1.5 flex items-start gap-1.5">
                            {bMeta && BIcon && (
                              <span className={`shrink-0 inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide ${bMeta.cls}`}><BIcon size={8} /> {bMeta.label}</span>
                            )}
                            <p className={`text-[12px] text-ink-muted ${isDossier ? 'line-clamp-3' : 'line-clamp-2'}`}>{raw}</p>
                          </div>
                        ) : bState === 'rejected' ? (
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <span className="shrink-0 inline-flex items-center gap-0.5 rounded bg-rose-50 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-rose-600"><X size={8} /> AI · rejected</span>
                            <span className="text-[11px] text-ink-subtle">Value was rejected &amp; cleared.</span>
                          </div>
                        ) : a.aiEnabled ? (
                          <p className="mt-1.5 text-[11px] text-ink-subtle">Not generated yet — click <span className="font-semibold text-brand-700">Run</span>.</p>
                        ) : null}

                        {/* provenance popover — полный аудит-таймлайн ячейки (M9.8) */}
                        {provFor === a.id && (
                          <div className="mt-2 rounded-md border border-brand-100 bg-brand-50/40 p-2.5 text-[11px]">
                            {provLoading ? (
                              <p className="inline-flex items-center gap-1.5 text-ink-subtle"><Loader2 size={11} className="animate-spin" /> Loading provenance…</p>
                            ) : !prov || (!prov.run && (!prov.timeline || prov.timeline.length === 0)) ? (
                              <p className="text-ink-subtle">No AI history yet for this field.{a.aiEnabled ? <> Click <span className="font-semibold text-brand-700">Run</span> to generate a value.</> : null}</p>
                            ) : (
                              <div className="space-y-2">
                                {/* статус-строка: review-статус + стоимость по ячейке + кол-во запусков */}
                                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-ink-muted">
                                  {prov.reviewable && prov.underReview && (
                                    <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1 text-[10px] font-bold text-amber-700"><AlertTriangle size={10} /> Under review · {prov.confidence ?? '—'}% conf</span>
                                  )}
                                  {prov.review && !prov.underReview && (
                                    <span className={`inline-flex items-center gap-1 rounded px-1 text-[10px] font-bold ${prov.review.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' : prov.review.status === 'REJECTED' ? 'bg-rose-50 text-rose-600' : 'bg-brand-50 text-brand-700'}`}>{prov.review.status}{prov.review.decidedBy ? ` · ${prov.review.decidedBy}` : ''}</span>
                                  )}
                                  <span className="inline-flex items-center gap-1" title="total AI credits actually spent on this cell"><Coins size={10} /> {prov.totalAiCost ?? 0} cr total</span>
                                  <span className="text-ink-subtle">· {prov.runCount} run{prov.runCount === 1 ? '' : 's'}</span>
                                </div>

                                {(prov.attribute.prompt || prov.attribute.guidance) && (
                                  <p className="text-ink-muted"><span className="font-semibold text-ink-subtle">Prompt:</span> {prov.attribute.prompt || prov.attribute.guidance}</p>
                                )}

                                {/* латест успешный output */}
                                {prov.run && prov.run.status === 'SUCCEEDED' && prov.run.outputText && (
                                  <p className="whitespace-pre-wrap rounded bg-surface p-1.5 text-[11px] text-ink-muted ring-1 ring-inset ring-line">{prov.run.outputText.slice(0, 260)}{prov.run.outputText.length > 260 ? '…' : ''}</p>
                                )}

                                {/* audit timeline — newest-first: runs + review decisions */}
                                {prov.timeline && prov.timeline.length > 0 && (
                                  <div className="space-y-1 border-t border-brand-100 pt-1.5">
                                    <p className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-ink-subtle">Audit timeline · newest first{prov.hasMore ? ` · latest ${prov.runsLimit ?? 10} of ${prov.runCount} runs` : ''}</p>
                                    {prov.timeline.map((e, i) => {
                                      const m = tlMeta(e.type, e.source);
                                      // AUTO: метка уже несёт «Auto-rerun» — не дублируем как actor.
                                      const showActor = e.actor && e.source !== 'AUTO';
                                      return (
                                        <div key={i} className="flex items-start gap-1.5">
                                          <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${m.dot}`} />
                                          <div className="min-w-0 flex-1">
                                            <span className="text-[11px] text-ink"><span className={`font-semibold ${m.color}`}>{m.label}</span>{showActor ? <span className="text-ink-muted"> · {e.actor}</span> : null}{e.cost > 0 ? <span className="text-ink-subtle"> · {e.cost} cr</span> : e.type === 'AI_FAILED' || e.type === 'AI_SKIPPED' ? <span className="text-ink-subtle"> · 0 cr · not charged</span> : null}<span className="text-ink-subtle"> · {timeAgo(e.at)}</span></span>
                                            {e.detail && <p className="truncate text-[10.5px] text-ink-subtle">{e.type === 'AI_FAILED' ? humanizeProviderError(e.detail) : e.detail}</p>}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        {raw ? (
                          isDossier ? (
                            <div className="mt-2">
                              <button type="button" onClick={() => setShowDossier((v) => !v)} className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-ink-subtle hover:text-ink">
                                <ChevronDown size={11} className={showDossier ? '' : '-rotate-90'} /> Dossier
                              </button>
                              {showDossier && <p className="mt-1 whitespace-pre-wrap rounded-md bg-surface-2/60 p-2 text-[11.5px] leading-relaxed text-ink-muted">{raw}</p>}
                            </div>
                          ) : (
                            <p className="mt-1.5 text-[12px] text-ink">{raw}</p>
                          )
                        ) : (
                          <p className="mt-1.5 text-[11.5px] italic text-ink-subtle">not filled yet</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* fields */}
            <section className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-subtle">Fields</p>
                {edit ? (
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => setEdit(false)} className="text-[11px] font-medium text-ink-muted hover:text-ink">Cancel</button>
                    <button type="button" disabled={saving} onClick={save} className="inline-flex h-6 items-center gap-1 rounded-md bg-brand-600 px-2 text-[11px] font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                      {saving ? <Loader2 size={10} className="animate-spin" /> : <Check size={11} />} Save
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={startEdit} className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:underline"><Pencil size={10} /> Edit</button>
                )}
              </div>
              <div className="rounded-lg border border-line [&>*:first-child]:rounded-t-lg [&>*:last-child]:rounded-b-lg">
                {fieldAttrs.map((a, i) => (
                  <div key={a.id} className={`flex items-start gap-3 px-3 py-2 ${i ? 'border-t border-line' : ''}`}>
                    <span className="mt-0.5 flex w-32 shrink-0 items-center gap-1 truncate text-[11.5px] font-medium text-ink-subtle">
                      {a.type === 'RELATIONSHIP' && <Link2 size={10} className="text-ink-subtle" />}{a.name}
                    </span>
                    <div className="min-w-0 flex-1 text-[12px]">
                      {a.type === 'RELATIONSHIP' ? (
                        <RelationshipField a={a} value={values[a.key]} recordId={recordId} onChanged={async () => { await load(); onChanged?.(); }} />
                      ) : edit && EDIT_INLINE.has(a.type) ? editor(a) : display(a)}
                      {edit && a.type !== 'RELATIONSHIP' && !EDIT_INLINE.has(a.type) && <span className="ml-1 text-[10px] text-ink-subtle">(read-only here)</span>}
                    </div>
                  </div>
                ))}
                {fieldAttrs.length === 0 && <p className="px-3 py-2 text-[12px] text-ink-subtle">No fields.</p>}
              </div>
            </section>

            {/* REL-2: обратные связи — записи, ссылающиеся на эту через forward-связь (read-only проекция + add/remove) */}
            <ReverseRelationships recordId={recordId} onChanged={async () => { await load(); onChanged?.(); }} />

            {/* M19-2: звонки, привязанные к этой записи (Calls tab) */}
            <RecordCalls recordId={recordId} />

            {/* M22-1: комментарии + @mention */}
            <section className="mt-5">
              <CommentThread recordId={recordId} />
            </section>

            {/* activity */}
            <section className="mt-5 pb-4">
              <p className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-ink-subtle"><History size={11} /> Activity</p>
              {acts.length === 0 ? (
                <p className="text-[12px] text-ink-subtle">No activity yet.</p>
              ) : (
                <ol className="relative space-y-3 border-l border-line pl-4">
                  {acts.map((a) => (
                    <li key={a.id} className="relative">
                      <span className={`absolute -left-[21px] top-1 h-2 w-2 rounded-full ring-2 ring-surface ${a.redacted ? 'bg-amber-400' : 'bg-brand-400'}`} />
                      <p className="text-[12px] font-medium text-ink">{a.redacted ? a.type.replace(/_/g, ' ').toLowerCase() : (a.title || a.type)}{a.redacted ? <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9.5px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200"><Lock size={9} /> restricted</span> : null}</p>
                      <p className="inline-flex items-center gap-1 text-[10.5px] text-ink-subtle"><Clock size={9} /> {timeAgo(a.createdAt)}{a.actor?.name ? ` · ${a.actor.name}` : ''}</p>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}
      </motion.aside>
    </>
  );
}

/* ── Relationship picker ───────────────────────────────────────────────────
   Редактирование RELATIONSHIP-атрибута: показывает связанную запись (имя из
   GET /records/:id, резолвится из RelationshipValue), позволяет привязать другую
   (поиск по целевому объекту) или отвязать. Сохраняет сразу через updateRecord
   (значение = массив target-id; одиночный выбор-замена). Бэкенд валидирует
   существование таргета и cardinality. */
type Linked = { id: string; displayName: string };
function toLinked(v: CrmRecordValue | undefined): Linked[] {
  if (v == null) return [];
  const arr = Array.isArray(v) ? v : [v];
  return arr
    .map((x): Linked | null => {
      if (x == null) return null;
      if (typeof x === 'object') { const o = x as Record<string, unknown>; const id = String(o.id ?? ''); return id ? { id, displayName: String(o.displayName ?? o.name ?? o.label ?? id) } : null; }
      const id = String(x); return id ? { id, displayName: id } : null;
    })
    .filter((x): x is Linked => x != null);
}

/* REL-2: обратные связи. Каждая группа = записи source-объекта, ссылающиеся на эту через forward-связь.
   Read-only проекция forward-данных; add/remove пишут ТОЛЬКО forward (rebind для *_TO_ONE на backend). */
function ReverseRelationships({ recordId, onChanged }: { recordId: string; onChanged: () => Promise<void> }) {
  const [groups, setGroups] = useState<ReverseGroup[] | null>(null);
  const reload = useCallback(() => { getReverseGroups(recordId).then(setGroups).catch(() => setGroups([])); }, [recordId]);
  useEffect(() => { reload(); }, [reload]);
  // показываем группы где есть связи ИЛИ можно добавлять
  const shown = (groups ?? []).filter((g) => g.total > 0 || g.editable);
  if (!groups || shown.length === 0) return null;
  return (
    <section className="mt-5">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-ink-subtle">Related from other records</p>
      <div className="space-y-2.5">
        {shown.map((g) => <ReverseGroupCard key={g.attributeId} recordId={recordId} group={g} onChanged={onChanged} />)}
      </div>
    </section>
  );
}

function ReverseGroupCard({ recordId, group, onChanged }: { recordId: string; group: ReverseGroup; onChanged: () => Promise<void> }) {
  const [g, setG] = useState<ReverseGroup>(group);
  const [recs, setRecs] = useState(group.records);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<{ id: string; displayName: string | null }[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { setG(group); setRecs(group.records); }, [group]);

  // после мутации перечитываем ТО ЖЕ окно, что было раскрыто (не схлопываем expand до 25) — адверс M1
  async function refetchWindow() {
    const win = Math.min(100, Math.max(25, recs.length));
    const full = await getReverseGroupPage(recordId, g.attributeId, 0, win);
    setG(full); setRecs(full.records);
  }
  async function showMore() {
    try {
      const page = await getReverseGroupPage(recordId, g.attributeId, recs.length, 25);
      // дедуп на слияние — страховка от offset-дрейфа при конкурентной вставке (адверс L2)
      setRecs((p) => { const seen = new Set(p.map((x) => x.id)); return [...p, ...page.records.filter((x) => !seen.has(x.id))]; });
      setG((p) => ({ ...p, hasMore: page.hasMore, total: page.total }));
    } catch { /* ignore */ }
  }
  // поиск source-записей для добавления
  useEffect(() => {
    if (!adding) return;
    let alive = true;
    const t = setTimeout(async () => {
      try { const r = await listRecords({ objectKey: g.sourceObjectKey, search: q.trim(), limit: 6 }); if (alive) setResults(r.records.filter((rec) => !recs.some((x) => x.id === rec.id))); }
      catch { if (alive) setResults([]); }
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [q, adding, g.sourceObjectKey, recs]);

  async function add(sourceRecordId: string) {
    setBusy(true); setErr(null);
    try { await reverseLinkAdd(recordId, g.attributeId, sourceRecordId); setQ(''); setResults([]); setAdding(false); await refetchWindow(); await onChanged(); }
    catch (e: unknown) { setErr((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Could not link'); }
    finally { setBusy(false); }
  }
  async function remove(sourceRecordId: string) {
    setBusy(true); setErr(null);
    try { await reverseLinkRemove(recordId, g.attributeId, sourceRecordId); await refetchWindow(); await onChanged(); }
    catch (e: unknown) { setErr((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Could not unlink'); }
    finally { setBusy(false); }
  }

  return (
    <div className="rounded-lg border border-line p-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Link2 size={11} className="shrink-0 text-brand-600" />
          <span className="truncate text-[12px] font-semibold text-ink">{g.name}</span>
          <span className="shrink-0 rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold text-ink-muted">{g.total}</span>
          {g.reverseOfLabel && <span className="truncate text-[10.5px] text-ink-subtle">· reverse of {g.reverseOfLabel}</span>}
        </div>
        {g.editable && !adding && <button type="button" onClick={() => setAdding(true)} className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-line px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"><Plus size={10} /> Link</button>}
      </div>

      {recs.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {recs.map((r) => (
            <span key={r.id} className="inline-flex items-center gap-1 rounded bg-surface-2 px-1.5 py-0.5 text-[11.5px] text-ink">
              <a href={r.href} className="hover:text-brand-700 hover:underline">{r.displayName || '(no name)'}</a>
              {g.editable && <button type="button" disabled={busy} onClick={() => remove(r.id)} title="Unlink" className="ml-0.5 text-ink-subtle hover:text-rose-600 disabled:opacity-50"><X size={10} /></button>}
            </span>
          ))}
        </div>
      ) : g.hiddenCount > 0 ? null : <p className="text-[11.5px] text-ink-subtle">No linked records yet.</p>}

      {/* RBAC: записи скрыты — показываем только число, без id/имён */}
      {g.hiddenCount > 0 && <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-ink-subtle"><Lock size={10} /> {g.hiddenCount} record{g.hiddenCount === 1 ? '' : 's'} — you don’t have access to this object’s data.</p>}

      {g.hasMore && <button type="button" onClick={showMore} className="mt-1.5 text-[11px] font-semibold text-brand-700 hover:underline">Show more ({g.total - recs.length})</button>}

      {adding && (
        <div className="mt-2 rounded-md border border-line bg-surface-2/40 p-1.5">
          <div className="flex items-center gap-1.5">
            <Search size={11} className="text-ink-subtle" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${g.sourceObjectKey}…`} className="min-w-0 flex-1 bg-transparent text-[12px] text-ink outline-none placeholder:text-ink-subtle" />
            <button type="button" onClick={() => { setAdding(false); setQ(''); }} className="text-ink-subtle hover:text-ink"><X size={12} /></button>
          </div>
          {results.length > 0 && (
            <div className="mt-1 max-h-40 overflow-y-auto">
              {results.map((r) => (
                <button key={r.id} type="button" disabled={busy} onClick={() => add(r.id)} className="block w-full truncate rounded px-1.5 py-1 text-left text-[12px] text-ink hover:bg-brand-50 disabled:opacity-50">{r.displayName || '(no name)'}</button>
              ))}
            </div>
          )}
        </div>
      )}
      {err && <p className="mt-1 text-[11px] text-rose-600">{err}</p>}
    </div>
  );
}

function RelationshipField({ a, value, recordId, onChanged }: { a: CrmAttribute; value: CrmRecordValue | undefined; recordId: string; onChanged: () => Promise<void> }) {
  const targetKey = String(a.config?.targetObjectKey ?? a.config?.relationObjectKey ?? '');
  const linked = toLinked(value);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<CrmRecord[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !targetKey) { setResults([]); return; }
    let alive = true; setSearching(true);
    const t = setTimeout(async () => {
      try { const r = await listRecords({ objectKey: targetKey, search: q.trim(), limit: 6 }); if (alive) setResults(r.records.filter((rec) => rec.id !== recordId)); }
      catch { if (alive) setResults([]); }
      finally { if (alive) setSearching(false); }
    }, 220);
    return () => { alive = false; clearTimeout(t); };
  }, [q, open, targetKey, recordId]);

  async function setLink(ids: string[]) {
    setBusy(true);
    try { await updateRecord(recordId, { [a.key]: ids }); await onChanged(); setOpen(false); setQ(''); }
    catch { /* no-op */ }
    finally { setBusy(false); }
  }

  if (!targetKey) {
    // нет цели в конфиге — показываем как было
    return linked.length ? <span className="inline-flex items-center gap-1 rounded bg-surface-2 px-1.5 py-0.5 text-[12px] text-ink"><Link2 size={11} className="text-brand-600" />{linked.map((l) => l.displayName).join(', ')}</span> : <span className="text-ink-subtle">—</span>;
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-1.5">
        {linked.map((l) => (
          <span key={l.id} className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-[12px] text-ink">
            <Link2 size={11} className="text-brand-600" />{l.displayName}
            <button type="button" disabled={busy} onClick={() => setLink(linked.filter((x) => x.id !== l.id).map((x) => x.id))} title="Unlink" className="ml-0.5 text-ink-subtle hover:text-rose-600 disabled:opacity-50"><X size={11} /></button>
          </span>
        ))}
        <button type="button" disabled={busy} onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 rounded-md border border-dashed border-line px-1.5 py-0.5 text-[11.5px] font-medium text-ink-muted hover:border-brand-300 hover:text-brand-600 disabled:opacity-50">
          {busy ? <Loader2 size={10} className="animate-spin" /> : <Plus size={11} />} {linked.length ? 'Change' : 'Link'}
        </button>
      </div>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-64 overflow-hidden rounded-lg border border-line bg-surface shadow-lg">
          <div className="flex items-center gap-1.5 border-b border-line px-2">
            <Search size={12} className="shrink-0 text-ink-subtle" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${targetKey}…`} className="h-8 flex-1 bg-transparent text-[12.5px] text-ink outline-none placeholder:text-ink-subtle" />
            {searching && <Loader2 size={11} className="animate-spin text-ink-subtle" />}
          </div>
          <div className="max-h-52 overflow-y-auto p-1">
            {results.length === 0 ? (
              <p className="px-2 py-3 text-center text-[12px] text-ink-subtle">{q.trim() ? 'No matches' : 'Type to search…'}</p>
            ) : results.map((r) => (
              <button key={r.id} type="button" disabled={busy} onClick={() => setLink([r.id])} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] text-ink hover:bg-surface-2 disabled:opacity-50">
                <Link2 size={12} className="shrink-0 text-brand-600" /><span className="truncate">{r.displayName || 'Untitled'}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* M17-5: запуск published record-совместимого workflow из RecordDrawer (тот же POST /:id/run, clientRequestId). */
function RunWorkflowButton({ recordId }: { recordId: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Workflow[] | null>(null);
  const [busy, setBusy] = useState(false);
  async function toggle() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (list === null) {
      try { const r = await workflowsApi.list(); setList(r.workflows.filter((w) => w.published && (w.trigger === 'RECORD_COMMAND' || w.trigger === 'MANUAL_RUN'))); }
      catch { setList([]); }
    }
  }
  async function run(w: Workflow) {
    setBusy(true);
    try { const r = await workflowsApi.runManual(w.id, { clientRequestId: crypto.randomUUID(), recordId }); toast.success(r.deduped ? 'Already run (deduped)' : `Ran · ${w.name}`, `Status: ${r.status ?? '—'}`); setOpen(false); }
    catch (e) { const err = e as { response?: { data?: { error?: string } } }; toast.error('Could not run', err.response?.data?.error || w.name); }
    finally { setBusy(false); }
  }
  return (
    <div className="relative">
      <button type="button" onClick={toggle} title="Run a published workflow on this record" className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-white px-2.5 text-[11.5px] font-semibold text-ink-muted hover:bg-surface-2"><Zap size={12} /> Run workflow</button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-60 rounded-lg border border-line bg-surface p-1 shadow-lg">
          {list === null ? <div className="px-2 py-3 text-center text-[12px] text-ink-subtle"><Loader2 size={12} className="mx-auto animate-spin" /></div>
            : list.length === 0 ? <div className="px-2 py-3 text-center text-[12px] text-ink-subtle">No published record workflows.</div>
              : list.map((w) => (
                <button key={w.id} type="button" disabled={busy} onClick={() => run(w)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] text-ink hover:bg-brand-50 disabled:opacity-50">
                  <Zap size={12} className="shrink-0 text-brand-600" /><span className="min-w-0 flex-1 truncate">{w.name}</span><span className="text-[10px] text-ink-subtle">v{w.publishedVersion}</span>
                </button>
              ))}
        </div>
      )}
    </div>
  );
}

/* M19-2: звонки, привязанные к записи (Calls tab на record page). Пусто → секция скрыта. */
function RecordCalls({ recordId }: { recordId: string }) {
  const [calls, setCalls] = useState<Call[]>([]);
  useEffect(() => { callsApi.list({ recordId }).then((r) => setCalls(r.calls)).catch(() => setCalls([])); }, [recordId]);
  if (calls.length === 0) return null;
  return (
    <section className="mt-5">
      <p className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-ink-subtle"><Phone size={11} /> Calls · {calls.length}</p>
      <div className="space-y-1.5">
        {calls.map((c) => (
          <div key={c.id} className="rounded-lg border border-line bg-surface px-2.5 py-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[12px] font-semibold text-ink">{c.lead?.name ?? 'Call'}</span>
              <span className="rounded bg-surface-2 px-1 py-0.5 text-[9px] font-bold uppercase text-ink-subtle">{c.status}</span>
              {c.outcome && <span className="text-[10px] text-ink-subtle">{c.outcome}</span>}
            </div>
            {c.summary && <p className="mt-0.5 line-clamp-2 text-[11px] text-ink-subtle">{c.summary}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
