'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import {
  Activity,
  Building2,
  ChevronDown,
  ExternalLink,
  FileText,
  Loader2,
  LayoutGrid,
  Lock,
  StickyNote,
  SquareCheckBig,
  MessageSquare,
  Phone,
  Mail,
  ArrowRightLeft,
  Paperclip,
  Sparkles,
  Info,
  ScanEye,
  AlertTriangle,
  Check,
  Pencil,
  X,
  Coins,
} from 'lucide-react';
import {
  getObject,
  getRecord,
  getRecordActivities,
  updateRecord,
  getAiProvenance,
  listAiReviewQueue,
  type CrmActivity,
  type CrmAttribute,
  type CrmAttributeOption,
  type CrmObjectDetail,
  type CrmRecord,
  type CrmRecordValue,
  type AiProvenance,
} from '@/lib/crmApi';
import RecordNotes from '@/components/data/RecordNotes';
import RecordTasks from '@/components/data/RecordTasks';
import RecordCalls from '@/components/data/RecordCalls';
import RecordEmails from '@/components/data/RecordEmails';
import RecordRelationships from '@/components/data/RecordRelationships';
import CommentThread from '@/components/data/CommentThread';
import ReviewQueue from '@/components/data/ReviewQueue';
import { authApi } from '@/lib/api';
import { useT, type TFunc } from '@/i18n';

interface PageProps {
  params: {
    objectKey: string;
    recordId: string;
  };
}

// M27 (1/2/3): только РЕАЛЬНЫЕ табы (no decorative). Files = honest-stub (storage не подключён — Q2).
type TabKey = 'overview' | 'activity' | 'notes' | 'tasks' | 'comments' | 'calls' | 'emails' | 'relationships' | 'files';
type DraftValue = string | string[] | boolean;

const tabs: Array<{ key: TabKey; labelKey: string }> = [
  { key: 'overview', labelKey: 'overview' },
  { key: 'activity', labelKey: 'activity' },
  { key: 'notes', labelKey: 'notes' },
  { key: 'tasks', labelKey: 'tasks' },
  { key: 'comments', labelKey: 'comments' },
  { key: 'calls', labelKey: 'calls' },
  { key: 'emails', labelKey: 'emails' },
  { key: 'relationships', labelKey: 'relationships' },
  { key: 'files', labelKey: 'files' },
];

const tagClasses = [
  'bg-yellow-50 text-yellow-800 ring-yellow-200',
  'bg-green-50 text-green-800 ring-green-200',
  'bg-blue-50 text-blue-800 ring-blue-200',
  'bg-purple-50 text-purple-800 ring-purple-200',
  'bg-pink-50 text-pink-800 ring-pink-200',
  'bg-orange-50 text-orange-800 ring-orange-200',
  'bg-slate-50 text-slate-800 ring-slate-200',
  'bg-emerald-50 text-emerald-800 ring-emerald-200',
];

// ── M29-2: provenance/source surfacing на full record-page (калька логики RecordDrawer) ──
// Атрибут считается AI-полем, если включён aiEnabled или задан aiType (есть AI-история/провенанс).
function isAiAttribute(attribute: CrmAttribute): boolean {
  return attribute.aiEnabled === true || attribute.aiType != null;
}

const aiSourceDot: Record<string, string> = {
  AI: 'bg-indigo-500',
  IMPORT: 'bg-gray-400',
  SYSTEM: 'bg-violet-500',
  MANUAL: 'bg-emerald-500',
};

// Честное происхождение текущего значения (из record.valueMeta) — не хардкод «всегда AI».
function valueSourceMeta(source: string | undefined, t: TFunc): { dot: string; label: string; title: string } {
  switch (source) {
    case 'AI': return { dot: aiSourceDot.AI, label: t('record.ai.sourceAi'), title: t('record.ai.sourceAiTitle') };
    case 'IMPORT': return { dot: aiSourceDot.IMPORT, label: t('record.ai.sourceImport'), title: t('record.ai.sourceImportTitle') };
    case 'SYSTEM': return { dot: aiSourceDot.SYSTEM, label: t('record.ai.sourceSystem'), title: t('record.ai.sourceSystemTitle') };
    default: return { dot: aiSourceDot.MANUAL, label: t('record.ai.sourceManual'), title: t('record.ai.sourceManualTitle') };
  }
}

function aiTimeAgo(iso: string, t: TFunc): string {
  const d = Date.parse(iso);
  if (Number.isNaN(d)) return '';
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return t('record.activity.justNow');
  if (s < 3600) return t('record.activity.minAgo', { n: Math.floor(s / 60) });
  if (s < 86400) return t('record.activity.hourAgo', { n: Math.floor(s / 3600) });
  return t('record.activity.dayAgo', { n: Math.floor(s / 86400) });
}

// Мета события аудит-таймлайна provenance-поповера (метка + цвет + точка).
function aiTlMeta(type: string, source: string | null | undefined, t: TFunc): { label: string; color: string; dot: string } {
  switch (type) {
    case 'AI_FILLED':
      return source === 'AUTO'
        ? { label: t('record.ai.tlAutoFilled'), color: 'text-violet-700', dot: 'bg-violet-500' }
        : { label: t('record.ai.tlAiFilled'), color: 'text-indigo-700', dot: 'bg-indigo-500' };
    case 'AI_FAILED': return { label: t('record.ai.tlAiFailed'), color: 'text-rose-600', dot: 'bg-rose-400' };
    case 'AI_SKIPPED': return { label: source === 'AUTO' ? t('record.ai.tlAutoSkipped') : t('record.ai.tlAiSkipped'), color: 'text-amber-700', dot: 'bg-amber-400' };
    case 'REVIEW_APPROVED': return { label: t('record.ai.tlApproved'), color: 'text-emerald-700', dot: 'bg-emerald-500' };
    case 'REVIEW_REJECTED': return { label: t('record.ai.tlRejectedCleared'), color: 'text-rose-600', dot: 'bg-rose-400' };
    case 'REVIEW_EDITED': return { label: t('record.ai.tlEdited'), color: 'text-indigo-700', dot: 'bg-indigo-500' };
    default: return { label: type, color: 'text-gray-700', dot: 'bg-gray-400' };
  }
}

// Состояние AI-значения для badge: явные стадии review-жизненного цикла.
// 'unknown' — provenance не загрузилась (RBAC/ошибка): не понижаем до generated.
type AiBadgeState = 'empty' | 'generated' | 'review' | 'reviewed' | 'edited' | 'rejected' | 'unknown';
function deriveAiBadge(p: AiProvenance, hasValue: boolean): AiBadgeState {
  if (p.underReview) return 'review';
  if (p.review) return p.review.status === 'APPROVED' ? 'reviewed' : p.review.status === 'EDITED' ? 'edited' : 'rejected';
  return hasValue ? 'generated' : 'empty';
}
function aiBadgeMeta(state: AiBadgeState, t: TFunc): { label: string; cls: string; icon: typeof Sparkles } | null {
  switch (state) {
    case 'generated': return { label: t('record.ai.badgeGenerated'), cls: 'bg-indigo-50 text-indigo-700', icon: Sparkles };
    case 'review': return { label: t('record.ai.badgeUnderReview'), cls: 'bg-amber-50 text-amber-700', icon: AlertTriangle };
    case 'reviewed': return { label: t('record.ai.badgeReviewed'), cls: 'bg-emerald-50 text-emerald-700', icon: Check };
    case 'edited': return { label: t('record.ai.badgeEdited'), cls: 'bg-violet-50 text-violet-700', icon: Pencil };
    case 'rejected': return { label: t('record.ai.badgeRejected'), cls: 'bg-rose-50 text-rose-600', icon: X };
    case 'unknown': return { label: t('record.ai.badgeUnknown'), cls: 'bg-gray-100 text-gray-600', icon: Sparkles };
    default: return null;
  }
}
// Не утекаем сырую ошибку провайдера в UI (полный текст остаётся в AiRun.error для аудита).
function humanizeAiError(err: string, t: TFunc): string {
  if (/DeepSeek|Anthropic|authentication|provider|LLM|aborted|timeout|ECONNREFUSED|fetch failed|\b(401|403|429|5\d\d)\b/i.test(err)) return t('record.ai.providerError');
  if (/Запись не найдена|not found/i.test(err)) return t('record.ai.recordNotFound');
  return err.length > 60 ? err.slice(0, 60) + '…' : err;
}

function isObjectValue(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hashText(text: string): number {
  let hash = 0;

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) % tagClasses.length;
  }

  return Math.abs(hash);
}

function formatScalar(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  if (Array.isArray(value)) {
    return value.map((item) => formatScalar(item)).filter(Boolean).join(', ');
  }

  if (isObjectValue(value)) {
    const label =
      value.displayName ??
      value.name ??
      value.label ??
      value.title ??
      value.key ??
      value.id ??
      JSON.stringify(value);

    return String(label);
  }

  return String(value);
}

// CURRENCY сериализуется как {amount, amountText, currencyCode} — форматируем по-человечески, не JSON.
function currencyParts(value: unknown): { amount: number; currency: string } | null {
  if (isObjectValue(value) && (typeof value.amount === 'number' || typeof value.amount === 'string')) {
    const amount = Number(value.amount);
    if (!Number.isFinite(amount)) return null;
    return { amount, currency: typeof value.currencyCode === 'string' ? value.currencyCode : 'USD' };
  }
  return null;
}
function formatCurrency(value: unknown): string {
  const parts = currencyParts(value);
  if (!parts) return formatScalar(value);
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: parts.currency, maximumFractionDigits: 0 }).format(parts.amount);
  } catch {
    return `${parts.amount}`;
  }
}

function formatDate(value: unknown): string {
  const text = formatScalar(value);

  if (!text) {
    return '';
  }

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    return text;
  }

  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date);
}

function formatDateInput(value: unknown): string {
  const text = formatScalar(value);

  if (!text) {
    return '';
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return text.slice(0, 10);
  }

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    return text;
  }

  return date.toISOString().slice(0, 10);
}

function normalizeUrl(value: string): string {
  if (!value) {
    return '';
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return `https://${value}`;
}

function getTagLabels(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => formatScalar(item)).filter(Boolean);
  }

  const text = formatScalar(value);

  if (!text) {
    return [];
  }

  if (text.includes(',')) {
    return text
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [text];
}

function getInitials(text: string): string {
  const parts = text
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) {
    return 'R';
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function getAttributeOptions(attribute: CrmAttribute): CrmAttributeOption[] {
  const rawOptions = [
    ...(attribute.options ?? []),
    ...(attribute.config?.options ?? []),
    ...(attribute.config?.choices ?? []),
  ];

  const seen = new Set<string>();
  const options: CrmAttributeOption[] = [];

  rawOptions.forEach((option) => {
    const key = option.key || option.label || option.name;

    if (!key || seen.has(key)) {
      return;
    }

    seen.add(key);
    options.push(option);
  });

  return options.sort((first, second) => {
    const firstOrder = typeof first.order === 'number' ? first.order : 0;
    const secondOrder = typeof second.order === 'number' ? second.order : 0;
    return firstOrder - secondOrder;
  });
}

function getOptionLabel(option: CrmAttributeOption): string {
  return option.label ?? option.name ?? option.key;
}

function resolveOptionKey(attribute: CrmAttribute, value: unknown): string {
  const text = formatScalar(value);
  const option = getAttributeOptions(attribute).find((item) => {
    return item.key === text || item.label === text || item.name === text;
  });

  return option?.key ?? text;
}

function resolveOptionLabel(attribute: CrmAttribute, value: unknown): string {
  const text = formatScalar(value);
  const option = getAttributeOptions(attribute).find((item) => {
    return item.key === text || item.label === text || item.name === text;
  });

  return option ? getOptionLabel(option) : text;
}

function getTagLabelsForAttribute(attribute: CrmAttribute, value: unknown): string[] {
  return getTagLabels(value).map((label) => resolveOptionLabel(attribute, label));
}

function valueToDraftValue(attribute: CrmAttribute, value: CrmRecordValue | undefined): DraftValue {
  if (attribute.type === 'BOOLEAN') {
    return value === true || value === 'true' || value === 1 || value === '1';
  }

  if (attribute.type === 'MULTI_SELECT') {
    return getTagLabels(value).map((item) => resolveOptionKey(attribute, item));
  }

  if (attribute.type === 'SELECT') {
    return resolveOptionKey(attribute, value);
  }

  if (attribute.type === 'DATE') {
    return formatDateInput(value);
  }

  if (attribute.type === 'CURRENCY') {
    const parts = currencyParts(value);
    return parts ? String(parts.amount) : formatScalar(value);
  }

  return formatScalar(value);
}

function normalizeDraftValue(attribute: CrmAttribute, value: DraftValue): CrmRecordValue {
  if (attribute.type === 'BOOLEAN') {
    return Boolean(value);
  }

  if (attribute.type === 'MULTI_SELECT') {
    if (Array.isArray(value)) {
      return value.filter(Boolean);
    }

    return String(value)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  const text = Array.isArray(value) ? value.join(', ') : String(value).trim();

  if (!text) {
    return null;
  }

  if (attribute.type === 'NUMBER' || attribute.type === 'CURRENCY') {
    const numberValue = Number(text);
    return Number.isNaN(numberValue) ? text : numberValue;
  }

  return text;
}

function getInputType(attribute: CrmAttribute): string {
  if (attribute.type === 'EMAIL') return 'email';
  if (attribute.type === 'URL') return 'url';
  if (attribute.type === 'NUMBER' || attribute.type === 'CURRENCY') return 'number';
  if (attribute.type === 'DATE') return 'date';

  return 'text';
}

function renderTabIcon(tab: TabKey) {
  const className = 'h-3.5 w-3.5';
  switch (tab) {
    case 'overview':
      return <LayoutGrid className={className} />;
    case 'activity':
      return <Activity className={className} />;
    case 'notes':
      return <StickyNote className={className} />;
    case 'tasks':
      return <SquareCheckBig className={className} />;
    case 'comments':
      return <MessageSquare className={className} />;
    case 'calls':
      return <Phone className={className} />;
    case 'emails':
      return <Mail className={className} />;
    case 'relationships':
      return <ArrowRightLeft className={className} />;
    case 'files':
      return <Paperclip className={className} />;
    default:
      return <Activity className={className} />;
  }
}

function renderTag(label: string) {
  const className = tagClasses[hashText(label)];

  return (
    <span
      key={label}
      className={`inline-flex max-w-[180px] items-center truncate rounded-md px-1.5 py-0.5 text-[12px] font-medium ring-1 ring-inset ${className}`}
      title={label}
    >
      {label}
    </span>
  );
}

function renderEmptyValue(attribute: CrmAttribute, t: TFunc) {
  return <span className="text-gray-400">{t('record.field.setPrompt', { name: attribute.name })}</span>;
}

function renderDisplayValue(attribute: CrmAttribute, value: CrmRecordValue | undefined, t: TFunc) {
  if (value === null || value === undefined || value === '') {
    return renderEmptyValue(attribute, t);
  }

  switch (attribute.type) {
    case 'URL': {
      const url = formatScalar(value);

      if (!url) {
        return renderEmptyValue(attribute, t);
      }

      return (
        <a
          href={normalizeUrl(url)}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="inline-flex min-w-0 items-center gap-1 truncate text-blue-700 underline-offset-2 hover:underline"
          title={url}
        >
          <span className="truncate">{url.replace(/^https?:\/\//, '')}</span>
          <ExternalLink className="h-3 w-3 shrink-0" />
        </a>
      );
    }

    case 'EMAIL': {
      const email = formatScalar(value);

      if (!email) {
        return renderEmptyValue(attribute, t);
      }

      return (
        <a
          href={`mailto:${email}`}
          onClick={(event) => event.stopPropagation()}
          className="truncate text-blue-700 underline-offset-2 hover:underline"
          title={email}
        >
          {email}
        </a>
      );
    }

    case 'SELECT':
    case 'MULTI_SELECT': {
      const labels = getTagLabelsForAttribute(attribute, value);

      if (!labels.length) {
        return renderEmptyValue(attribute, t);
      }

      return <div className="flex min-w-0 flex-wrap gap-1">{labels.map(renderTag)}</div>;
    }

    case 'BOOLEAN': {
      const checked = value === true || value === 'true' || value === 1 || value === '1';

      return checked ? (
        <span className="text-gray-900">{t('record.field.yes')}</span>
      ) : (
        <span className="text-gray-400">{t('record.field.no')}</span>
      );
    }

    case 'DATE': {
      const date = formatDate(value);
      return date ? <span className="truncate text-gray-900">{date}</span> : renderEmptyValue(attribute, t);
    }

    case 'CURRENCY': {
      const text = formatCurrency(value);
      return text ? <span className="truncate text-gray-900" title={text}>{text}</span> : renderEmptyValue(attribute, t);
    }

    case 'LOCATION':
    case 'NUMBER':
    case 'RELATIONSHIP':
    case 'TEXT':
    default: {
      const text = formatScalar(value);

      return text ? (
        <span className="truncate text-gray-900" title={text}>
          {text}
        </span>
      ) : (
        renderEmptyValue(attribute, t)
      );
    }
  }
}

export default function RecordPage({ params }: PageProps) {
  const t = useT();
  const objectKey = params.objectKey;
  const recordId = params.recordId;

  const [object, setObject] = useState<CrmObjectDetail | null>(null);
  const [record, setRecord] = useState<CrmRecord | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [systemOpen, setSystemOpen] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState<DraftValue>('');
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Активности записи (S061)
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  // M29-2 surfacing: review-queue + provenance на full record-page (тонкая интеграция готовых endpoints).
  const [canManage, setCanManage] = useState(false);          // role !== MEMBER → может approve/reject/edit
  const [reviewOpen, setReviewOpen] = useState(false);        // модалка ReviewQueue (переиспользуем компонент M9.3)
  const [reviewCount, setReviewCount] = useState(0);          // «N to review» — low-confidence AI-значения объекта
  const [provFor, setProvFor] = useState<string | null>(null); // раскрытый provenance-popover (attributeId)
  const [prov, setProv] = useState<AiProvenance | null>(null);
  const [provLoading, setProvLoading] = useState(false);
  const [badgeStates, setBadgeStates] = useState<Record<string, AiBadgeState>>({}); // review-стадия AI-поля для badge

  const attributes = useMemo(() => {
    if (!object) {
      return [];
    }

    return [...object.attributes].sort((first, second) => {
      const firstOrder = typeof first.order === 'number' ? first.order : 0;
      const secondOrder = typeof second.order === 'number' ? second.order : 0;
      return firstOrder - secondOrder;
    });
  }, [object]);

  const displayName = record?.displayName || 'Record';

  // M27-1 Highlights (generic-derived, без hardcode): name уже в шапке → берём первые N видимых, не-AI,
  // не-primary атрибутов с ЗАПОЛНЕННЫМ значением. Работает для любого объекта (Companies/People/Deals/custom).
  const highlights = useMemo(() => {
    if (!record) return [];
    return attributes
      .filter((a) => !a.isPrimary && !a.aiEnabled && a.type !== 'RELATIONSHIP')
      .filter((a) => {
        const v = record.values?.[a.key];
        return formatScalar(v) !== '' || (Array.isArray(v) && v.length > 0);
      })
      .slice(0, 6);
  }, [attributes, record]);

  // M29-2: AI-атрибуты записи (есть provenance/review-жизненный цикл).
  const aiAttrs = useMemo(() => attributes.filter(isAiAttribute), [attributes]);

  async function loadRecord() {
    setIsLoading(true);
    setLoadError(null);

    try {
      const [objectData, recordData] = await Promise.all([getObject(objectKey), getRecord(recordId)]);
      setObject(objectData);
      setRecord(recordData);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : t('record.errors.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }

  // M29-2: «N to review» для текущего объекта (low-confidence AI-значения). Читать может любой с доступом к объекту.
  async function loadReviewCount() {
    try {
      const r = await listAiReviewQueue(objectKey);
      setReviewCount(r.total);
    } catch {
      setReviewCount(0); // нет доступа/ошибка — счётчик не показываем
    }
  }

  // M29-2: review-стадия каждого AI-поля (badge generated/review/reviewed/edited/rejected).
  // Provenance гейтится бэком по RBAC (404 для MEMBER) → на ошибке падаем к source-based badge, не понижая стадию.
  async function loadBadgeStates(aiList: CrmAttribute[], rec: CrmRecord) {
    const entries = await Promise.all(
      aiList.map(async (a) => {
        const hasValue = formatScalar(rec.values?.[a.key]) !== '';
        const src = rec.valueMeta?.[a.key]?.source;
        try {
          const p = await getAiProvenance(a.id, recordId);
          return [a.id, deriveAiBadge(p, hasValue)] as const;
        } catch {
          // Без provenance: AI-значение → generated; ручное/импорт/система или пусто → без AI-badge.
          return [a.id, hasValue && src === 'AI' ? ('generated' as AiBadgeState) : ('empty' as AiBadgeState)] as const;
        }
      }),
    );
    setBadgeStates(Object.fromEntries(entries));
  }

  // M29-2: toggle provenance-popover ячейки (последний AiRun + аудит-таймлайн).
  async function openProvenance(attributeId: string) {
    if (provFor === attributeId) { setProvFor(null); return; }
    setProvFor(attributeId);
    setProv(null);
    setProvLoading(true);
    try {
      setProv(await getAiProvenance(attributeId, recordId));
    } catch {
      setProv(null);
    } finally {
      setProvLoading(false);
    }
  }

  // M29-2: после approve/reject/edit в очереди — тихо обновить счётчик, значения и review-стадии (без full-page спиннера).
  async function refreshAfterReview() {
    await loadReviewCount();
    try {
      const rec = await getRecord(recordId);
      setRecord(rec);
      if (aiAttrs.length) await loadBadgeStates(aiAttrs, rec);
    } catch {
      /* no-op: запись могла стать недоступна — оставляем текущее состояние */
    }
  }

  async function loadActivities() {
    setActivitiesLoading(true);

    try {
      const result = await getRecordActivities(recordId);
      setActivities(result.activities);
    } catch {
      // Не критично — пустой список
    } finally {
      setActivitiesLoading(false);
    }
  }

  useEffect(() => {
    void loadRecord();
  }, [objectKey, recordId]);

  // M29-2: роль текущего пользователя — гейт UI approve/reject/edit (бэк гейтит независимо).
  useEffect(() => {
    authApi.me().then((u) => setCanManage(u.role !== 'MEMBER')).catch(() => setCanManage(false));
  }, []);

  // M29-2: после загрузки записи — счётчик review-очереди + review-стадии AI-полей.
  useEffect(() => {
    if (isLoading || !record || !object) return;
    void loadReviewCount();
    if (aiAttrs.length) void loadBadgeStates(aiAttrs, record);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, recordId, objectKey]);

  // Загружаем активности при открытии вкладки Activity (S061)
  useEffect(() => {
    if (activeTab === 'activity' && !isLoading && record) {
      void loadActivities();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isLoading, recordId]);

  function startEdit(attribute: CrmAttribute) {
    if (!record || savingKey) {
      return;
    }

    setSaveError(null);
    setEditingKey(attribute.key);
    setDraftValue(valueToDraftValue(attribute, record.values?.[attribute.key]));
  }

  function cancelEdit() {
    setEditingKey(null);
    setDraftValue('');
  }

  async function handleSave(attribute: CrmAttribute, value: DraftValue = draftValue) {
    if (!record) {
      return;
    }

    const normalizedValue = normalizeDraftValue(attribute, value);
    const previousRecord = record;
    const nextDisplayName =
      attribute.isPrimary && formatScalar(normalizedValue)
        ? formatScalar(normalizedValue)
        : previousRecord.displayName;

    const optimisticRecord: CrmRecord = {
      ...previousRecord,
      displayName: nextDisplayName,
      values: {
        ...previousRecord.values,
        [attribute.key]: normalizedValue,
      },
    };

    setEditingKey(null);
    setDraftValue('');
    setSavingKey(attribute.key);
    setSaveError(null);
    setRecord(optimisticRecord);

    try {
      const updatedRecord = await updateRecord(record.id, {
        [attribute.key]: normalizedValue,
      });

      setRecord(updatedRecord);
    } catch (err) {
      setRecord(previousRecord);
      setSaveError(err instanceof Error ? err.message : t('record.errors.saveFailed'));
    } finally {
      setSavingKey(null);
    }
  }

  function handleEditorKeyDown(
    event: KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
    attribute: CrmAttribute,
  ) {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelEdit();
      return;
    }

    if (event.key === 'Enter' && attribute.type !== 'MULTI_SELECT') {
      event.preventDefault();
      event.currentTarget.blur();
    }
  }

  function renderEditor(attribute: CrmAttribute) {
    const options = getAttributeOptions(attribute);

    if (attribute.type === 'BOOLEAN') {
      const checked = Boolean(draftValue);

      return (
        <label className="inline-flex items-center gap-2">
          <input
            autoFocus
            type="checkbox"
            checked={checked}
            onChange={(event) => {
              setDraftValue(event.target.checked);
              void handleSave(attribute, event.target.checked);
            }}
            onKeyDown={(event) => handleEditorKeyDown(event, attribute)}
            className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600"
          />
          <span className="text-[13px] text-gray-700">{checked ? t('record.field.yes') : t('record.field.no')}</span>
        </label>
      );
    }

    if (attribute.type === 'SELECT' && options.length > 0) {
      const value = typeof draftValue === 'string' ? draftValue : '';

      return (
        <select
          autoFocus
          value={value}
          onChange={(event) => {
            setDraftValue(event.target.value);
            void handleSave(attribute, event.target.value);
          }}
          onKeyDown={(event) => handleEditorKeyDown(event, attribute)}
          className="h-7 w-full rounded-md border border-blue-200 bg-white px-2 text-[13px] text-gray-900 outline-none ring-blue-100 focus:border-blue-500 focus:ring-2"
        >
          <option value="">{t('record.field.unset')}</option>
          {options.map((option) => (
            <option key={option.key} value={option.key}>
              {getOptionLabel(option)}
            </option>
          ))}
        </select>
      );
    }

    if (attribute.type === 'MULTI_SELECT' && options.length > 0) {
      const values = Array.isArray(draftValue) ? draftValue : [];

      return (
        <select
          autoFocus
          multiple
          value={values}
          onChange={(event) => {
            const selected = Array.from(event.target.selectedOptions).map((option) => option.value);
            setDraftValue(selected);
          }}
          onBlur={() => void handleSave(attribute)}
          onKeyDown={(event) => handleEditorKeyDown(event, attribute)}
          className="min-h-[76px] w-full rounded-md border border-blue-200 bg-white px-2 py-1 text-[13px] text-gray-900 outline-none ring-blue-100 focus:border-blue-500 focus:ring-2"
        >
          {options.map((option) => (
            <option key={option.key} value={option.key}>
              {getOptionLabel(option)}
            </option>
          ))}
        </select>
      );
    }

    const value = Array.isArray(draftValue) ? draftValue.join(', ') : String(draftValue);

    return (
      <input
        autoFocus
        type={getInputType(attribute)}
        value={value}
        step={attribute.type === 'NUMBER' || attribute.type === 'CURRENCY' ? 'any' : undefined}
        onChange={(event) => setDraftValue(event.target.value)}
        onBlur={() => void handleSave(attribute)}
        onKeyDown={(event) => handleEditorKeyDown(event, attribute)}
        onFocus={(event) => event.currentTarget.select()}
        className="h-7 w-full rounded-md border border-blue-200 bg-white px-2 text-[13px] text-gray-900 outline-none ring-blue-100 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2"
      />
    );
  }

  function renderActivityTypeLabel(type: string): string {
    switch (type) {
      case 'RECORD_CREATED': return t('record.activity.created');
      case 'RECORD_UPDATED': return t('record.activity.updated');
      case 'RECORD_ARCHIVED': return t('record.activity.archived');
      default: return type.replace(/_/g, ' ').toLowerCase();
    }
  }

  function renderTabContent() {
    if (activeTab === 'overview') {
      return (
        <div className="min-h-[360px] px-4 py-4">
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-gray-400">{t('record.overview.highlights')}</h2>
          {highlights.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-[13px] text-gray-500">
              {t('record.overview.highlightsEmpty')}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {highlights.map((attribute) => (
                <div key={attribute.id} className="min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <div className="truncate text-[11px] font-medium uppercase tracking-[0.04em] text-gray-400" title={attribute.name}>{attribute.name}</div>
                  <div className="mt-0.5 min-w-0 text-[13px] text-gray-900">{renderDisplayValue(attribute, record!.values?.[attribute.key], t)}</div>
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 text-[12px] text-gray-400">{t('record.overview.help')}</p>
        </div>
      );
    }

    if (activeTab === 'activity') {
      if (activitiesLoading) {
        return (
          <div className="flex h-full min-h-[360px] items-center justify-center text-[13px] text-gray-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-gray-400" />
            {t('record.activity.loading')}
          </div>
        );
      }

      if (!activities.length) {
        return (
          <div className="flex h-full min-h-[360px] items-center justify-center text-[13px] text-gray-500">
            <div className="text-center">
              <Activity className="mx-auto mb-2 h-5 w-5 text-gray-300" />
              <div>{t('record.activity.empty')}</div>
            </div>
          </div>
        );
      }

      return (
        <div className="min-h-[360px] px-4 py-3">
          <ol className="space-y-3">
            {activities.map((activity) => (
              <li key={activity.id} className="flex gap-3">
                <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${activity.redacted ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-500'}`}>
                  {activity.redacted ? <Lock className="h-3 w-3" /> : <Activity className="h-3 w-3" />}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-medium text-gray-900">
                      {/* M27-1: redacted → не раскрываем title/body, показываем безопасную метку типа + «Restricted» */}
                      {activity.redacted ? renderActivityTypeLabel(activity.type) : (activity.title ?? renderActivityTypeLabel(activity.type))}
                    </span>
                    {activity.redacted ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200"><Lock className="h-2.5 w-2.5" /> {t('record.activity.restricted')}</span>
                    ) : null}
                    <span className="text-[12px] text-gray-400">
                      {new Intl.DateTimeFormat('ru', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(activity.createdAt))}
                    </span>
                  </div>

                  {activity.actor ? (
                    <div className="mt-0.5 text-[12px] text-gray-500">{activity.actor.name ?? activity.actor.email}</div>
                  ) : null}

                  {activity.redacted ? (
                    <div className="mt-1 text-[12px] italic text-gray-400">{t('record.activity.accessDenied')}</div>
                  ) : activity.body ? (
                    <div className="mt-1 text-[13px] text-gray-700">{activity.body}</div>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </div>
      );
    }

    // M27-2/M27-3: лениво монтируем таб — данные грузятся ТОЛЬКО при открытии (не ради бейджа).
    if (activeTab === 'notes') return <RecordNotes recordId={recordId} />;
    if (activeTab === 'tasks') return <RecordTasks recordId={recordId} />;
    if (activeTab === 'comments') return <div className="min-h-[360px] px-4 py-4"><CommentThread recordId={recordId} /></div>;
    if (activeTab === 'calls') return <RecordCalls recordId={recordId} />;
    if (activeTab === 'emails') return <RecordEmails recordId={recordId} />;
    if (activeTab === 'relationships') return <RecordRelationships recordId={recordId} object={object!} record={record!} />;
    if (activeTab === 'files') return (
      <div className="min-h-[360px] px-4 py-4">
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-12 text-center">
          <Paperclip className="mx-auto mb-2 h-5 w-5 text-gray-300" />
          <p className="text-[13px] font-medium text-gray-600">{t('record.files.storageNotConnected')}</p>
          <p className="mt-1 text-[12px] text-gray-400">{t('record.files.storageDescription')}</p>
        </div>
      </div>
    );

    return (
      <div className="flex h-full min-h-[360px] items-center justify-center text-[13px] text-gray-500">
        {t('record.errors.noData')}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center bg-white text-[13px] text-gray-600">
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-gray-400" />
        {t('record.errors.pageLoading')}
      </div>
    );
  }

  if (loadError || !object || !record) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center bg-white px-6 text-center">
        <div>
          <div className="text-[14px] font-semibold text-gray-950">{t('record.errors.openFailed')}</div>
          <div className="mt-1 text-[13px] text-gray-500">{loadError ?? t('record.errors.notFound')}</div>
          <button
            type="button"
            onClick={() => void loadRecord()}
            className="mt-4 h-8 rounded-md border border-gray-200 bg-white px-3 text-[13px] font-medium text-gray-700 hover:bg-gray-50"
          >
            {t('record.errors.retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-screen flex-col bg-white text-[13px] text-gray-800">
      <header className="shrink-0 border-b border-gray-200 bg-white">
        <div className="flex h-10 items-center justify-between border-b border-gray-100 px-4">
          <div className="flex min-w-0 items-center gap-2 text-[13px] text-gray-500">
            <Link
              href={`/crm/${encodeURIComponent(object.key)}`}
              className="inline-flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-gray-600 hover:bg-gray-50 hover:text-gray-950"
            >
              <Building2 className="h-3.5 w-3.5 shrink-0 text-blue-600" />
              <span className="truncate">{object.pluralName}</span>
            </Link>

            <span className="text-gray-300">/</span>

            <span className="truncate font-medium text-gray-800">{displayName}</span>
          </div>
        </div>

        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-[12px] font-semibold text-gray-600">
              {getInitials(displayName)}
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-[16px] font-semibold text-gray-950">{displayName}</h1>
              <div className="mt-1 flex items-center gap-1.5 text-[12px] text-gray-500">
                <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-gray-700">
                  {object.singularName}
                </span>
                <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-gray-700">
                  {object.key}
                </span>
              </div>
            </div>
          </div>

          {/* M29-2: индикатор review-очереди AI-полей объекта → открывает ReviewQueue (M9.3). */}
          {aiAttrs.length > 0 && (
            <button
              type="button"
              onClick={() => setReviewOpen(true)}
              title={t('record.ai.reviewQueueTitle')}
              className={[
                'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-[13px] font-medium transition-colors',
                reviewCount > 0
                  ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
              ].join(' ')}
            >
              <ScanEye className="h-3.5 w-3.5" />
              {reviewCount > 0 ? t('record.ai.toReview', { count: reviewCount }) : t('record.ai.reviewAi')}
            </button>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col bg-white">
          <div className="flex h-10 shrink-0 items-center border-b border-gray-200 px-3">
            {tabs.map((tab) => {
              const isActive = tab.key === activeTab;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={[
                    'mr-1 inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[13px]',
                    isActive
                      ? 'border-gray-300 bg-white font-medium text-gray-950 shadow-sm'
                      : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-950',
                  ].join(' ')}
                >
                  {renderTabIcon(tab.key)}
                  <span>{t('record.tab.' + tab.labelKey)}</span>
                </button>
              );
            })}
          </div>

          <div className="min-h-0 flex-1 overflow-auto bg-white">{renderTabContent()}</div>
        </main>

        <aside className="flex w-[430px] shrink-0 flex-col border-l border-gray-200 bg-white">
          <div className="flex h-10 shrink-0 items-center border-b border-gray-200 px-3">
            <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 text-[13px] font-medium text-gray-950 shadow-sm">
              <FileText className="h-3.5 w-3.5" />
              {t('record.details.details')}
            </span>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            <section className="border-b border-gray-200">
              <button
                type="button"
                onClick={() => setDetailsOpen((v) => !v)}
                className="flex h-10 w-full items-center gap-2 px-4 text-left text-[13px] font-medium text-gray-900 hover:bg-gray-50"
              >
                <ChevronDown className={`h-3.5 w-3.5 text-gray-500 transition-transform ${detailsOpen ? '' : '-rotate-90'}`} />
                {t('record.details.recordDetails')}
              </button>

              <div className={`pb-2 ${detailsOpen ? '' : 'hidden'}`}>
                {attributes.map((attribute) => {
                  const value = record.values?.[attribute.key];
                  const isEditing = editingKey === attribute.key;
                  const isSaving = savingKey === attribute.key;

                  // M29-2: AI-поле — показываем честное происхождение значения + review-стадию + provenance-popover.
                  const isAi = isAiAttribute(attribute);
                  const hasValue = formatScalar(value) !== '' || (Array.isArray(value) && value.length > 0);
                  const vSrc = record.valueMeta?.[attribute.key]?.source;
                  let bState: AiBadgeState = badgeStates[attribute.id] ?? (hasValue ? 'generated' : 'empty');
                  // Значение НЕ от AI (ручное/импорт/система) не должно показывать «Generated by AI».
                  if ((vSrc === 'MANUAL' || vSrc === 'IMPORT' || vSrc === 'SYSTEM') && bState === 'generated') bState = 'empty';
                  const bMeta = isAi ? aiBadgeMeta(bState, t) : null;
                  const BIcon = bMeta?.icon;
                  const sm = valueSourceMeta(vSrc, t);

                  return (
                    <div
                      key={attribute.id}
                      className="grid grid-cols-[128px_minmax(0,1fr)] gap-3 px-4 py-2 hover:bg-gray-50"
                    >
                      <div className="flex min-w-0 items-center gap-1.5 text-[12px] text-gray-500">
                        {isAi ? (
                          <Sparkles className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                        ) : (
                          <span className="h-3.5 w-3.5 shrink-0 rounded-sm border border-gray-200 bg-white" />
                        )}
                        <span className="truncate" title={attribute.name}>
                          {attribute.name}
                        </span>
                      </div>

                      <div className="min-w-0">
                        {isEditing ? (
                          renderEditor(attribute)
                        ) : (
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => startEdit(attribute)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                startEdit(attribute);
                              }
                            }}
                            className="flex min-h-[24px] min-w-0 cursor-text items-center rounded-md px-1 py-0.5 outline-none hover:bg-white focus:bg-white focus:ring-2 focus:ring-blue-100"
                          >
                            {renderDisplayValue(attribute, value, t)}
                          </div>
                        )}

                        {isSaving ? (
                          <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-gray-400">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            {t('record.field.saving')}
                          </div>
                        ) : null}

                        {/* M29-2: provenance-полоса AI-поля — значок происхождения (только у заполненного), review-badge, Provenance. */}
                        {isAi ? (
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 px-1">
                            {hasValue ? (
                              <span
                                className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-gray-500"
                                title={sm.title}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full ${sm.dot}`} /> {sm.label}
                              </span>
                            ) : null}
                            {bMeta && BIcon ? (
                              <span className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9.5px] font-bold uppercase tracking-wide ${bMeta.cls}`}>
                                <BIcon className="h-2.5 w-2.5" /> {bMeta.label}
                              </span>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => void openProvenance(attribute.id)}
                              title={t('record.ai.provenanceTitle')}
                              className={`inline-flex h-6 items-center gap-1 rounded-md border px-1.5 text-[10.5px] font-semibold transition-colors ${
                                provFor === attribute.id
                                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                                  : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                              }`}
                            >
                              <Info className="h-3 w-3" /> {t('record.ai.provenance')}
                            </button>
                          </div>
                        ) : null}

                        {/* M29-2: provenance-popover — последний AiRun + аудит-таймлайн (read-only; Run AI — в drawer). */}
                        {isAi && provFor === attribute.id ? (
                          <div className="mt-1.5 rounded-md border border-indigo-100 bg-indigo-50/40 p-2.5 text-[11px]">
                            {provLoading ? (
                              <p className="inline-flex items-center gap-1.5 text-gray-500">
                                <Loader2 className="h-3 w-3 animate-spin" /> {t('record.ai.provenanceLoading')}
                              </p>
                            ) : !prov || (!prov.run && (!prov.timeline || prov.timeline.length === 0)) ? (
                              <p className="text-gray-500">{t('record.ai.provenanceEmpty')}</p>
                            ) : (
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-gray-600">
                                  {prov.reviewable && prov.underReview ? (
                                    <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1 text-[10px] font-bold text-amber-700">
                                      <AlertTriangle className="h-2.5 w-2.5" /> {t('record.ai.underReview')} · {prov.confidence ?? '—'}{t('record.ai.confPercent')}
                                    </span>
                                  ) : null}
                                  {prov.review && !prov.underReview ? (
                                    <span className={`inline-flex items-center gap-1 rounded px-1 text-[10px] font-bold ${
                                      prov.review.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700'
                                        : prov.review.status === 'REJECTED' ? 'bg-rose-50 text-rose-600'
                                          : 'bg-indigo-50 text-indigo-700'
                                    }`}>
                                      {prov.review.status}{prov.review.decidedBy ? ` · ${prov.review.decidedBy}` : ''}
                                    </span>
                                  ) : null}
                                  <span className="inline-flex items-center gap-1" title={t('record.ai.totalCostTitle')}>
                                    <Coins className="h-2.5 w-2.5" /> {t('record.ai.crTotalN', { n: prov.totalAiCost ?? 0 })}
                                  </span>
                                  <span className="text-gray-400">· {prov.runCount} {t(prov.runCount === 1 ? 'record.ai.run' : 'record.ai.runs')}</span>
                                </div>

                                {prov.attribute.prompt || prov.attribute.guidance ? (
                                  <p className="text-gray-600"><span className="font-semibold text-gray-500">{t('record.ai.prompt')}</span> {prov.attribute.prompt || prov.attribute.guidance}</p>
                                ) : null}

                                {prov.run && prov.run.status === 'SUCCEEDED' && prov.run.outputText ? (
                                  <p className="whitespace-pre-wrap rounded bg-white p-1.5 text-[11px] text-gray-600 ring-1 ring-inset ring-gray-200">
                                    {prov.run.outputText.slice(0, 260)}{prov.run.outputText.length > 260 ? '…' : ''}
                                  </p>
                                ) : null}

                                {prov.timeline && prov.timeline.length > 0 ? (
                                  <div className="space-y-1 border-t border-indigo-100 pt-1.5">
                                    <p className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-gray-400">
                                      {t('record.ai.auditTimeline')}{prov.hasMore ? t('record.ai.auditLatest', { limit: prov.runsLimit ?? 10, count: prov.runCount }) : ''}
                                    </p>
                                    {prov.timeline.map((e, i) => {
                                      const m = aiTlMeta(e.type, e.source, t);
                                      const showActor = e.actor && e.source !== 'AUTO';
                                      return (
                                        <div key={i} className="flex items-start gap-1.5">
                                          <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${m.dot}`} />
                                          <div className="min-w-0 flex-1">
                                            <span className="text-[11px] text-gray-800">
                                              <span className={`font-semibold ${m.color}`}>{m.label}</span>
                                              {showActor ? <span className="text-gray-500"> · {e.actor}</span> : null}
                                              {e.cost > 0 ? <span className="text-gray-400">{t('record.ai.auditCost', { n: e.cost })}</span> : e.type === 'AI_FAILED' || e.type === 'AI_SKIPPED' ? <span className="text-gray-400">{t('record.ai.auditNotCharged')}</span> : null}
                                              <span className="text-gray-400"> · {aiTimeAgo(e.at, t)}</span>
                                            </span>
                                            {e.detail ? <p className="truncate text-[10.5px] text-gray-400">{e.type === 'AI_FAILED' ? humanizeAiError(e.detail, t) : e.detail}</p> : null}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : null}
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="border-b border-gray-200">
              <button
                type="button"
                onClick={() => setSystemOpen((v) => !v)}
                className="flex h-10 w-full items-center gap-2 px-4 text-left text-[13px] font-medium text-gray-900 hover:bg-gray-50"
              >
                <ChevronDown className={`h-3.5 w-3.5 text-gray-500 transition-transform ${systemOpen ? '' : '-rotate-90'}`} />
                {t('record.details.system')}
              </button>

              <div className={`pb-2 ${systemOpen ? '' : 'hidden'}`}>
                <div className="grid grid-cols-[128px_minmax(0,1fr)] gap-3 px-4 py-2">
                  <div className="text-[12px] text-gray-500">{t('record.details.recordId')}</div>
                  <div className="truncate text-[13px] text-gray-900" title={record.id}>
                    {record.id}
                  </div>
                </div>

                <div className="grid grid-cols-[128px_minmax(0,1fr)] gap-3 px-4 py-2">
                  <div className="text-[12px] text-gray-500">{t('record.details.created')}</div>
                  <div className="truncate text-[13px] text-gray-900">
                    {record.createdAt ? formatDate(record.createdAt) : '—'}
                  </div>
                </div>

                <div className="grid grid-cols-[128px_minmax(0,1fr)] gap-3 px-4 py-2">
                  <div className="text-[12px] text-gray-500">{t('record.details.updated')}</div>
                  <div className="truncate text-[13px] text-gray-900">
                    {record.updatedAt ? formatDate(record.updatedAt) : '—'}
                  </div>
                </div>
              </div>
            </section>

            {saveError ? (
              <div className="m-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
                {saveError}
              </div>
            ) : null}
          </div>
        </aside>
      </div>

      {/* M29-2: очередь ревью низкоуверенных AI-значений объекта (переиспользуем компонент M9.3). */}
      <ReviewQueue
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        objectKey={objectKey}
        canManage={canManage}
        onChanged={() => void refreshAfterReview()}
      />
    </div>
  );
}