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
} from 'lucide-react';
import {
  getObject,
  getRecord,
  getRecordActivities,
  updateRecord,
  type CrmActivity,
  type CrmAttribute,
  type CrmAttributeOption,
  type CrmObjectDetail,
  type CrmRecord,
  type CrmRecordValue,
} from '@/lib/crmApi';
import RecordNotes from '@/components/data/RecordNotes';
import RecordTasks from '@/components/data/RecordTasks';
import RecordCalls from '@/components/data/RecordCalls';
import RecordEmails from '@/components/data/RecordEmails';
import RecordRelationships from '@/components/data/RecordRelationships';
import CommentThread from '@/components/data/CommentThread';

interface PageProps {
  params: {
    objectKey: string;
    recordId: string;
  };
}

// M27 (1/2/3): только РЕАЛЬНЫЕ табы (no decorative). Files = honest-stub (storage не подключён — Q2).
type TabKey = 'overview' | 'activity' | 'notes' | 'tasks' | 'comments' | 'calls' | 'emails' | 'relationships' | 'files';
type DraftValue = string | string[] | boolean;

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'activity', label: 'Activity' },
  { key: 'notes', label: 'Notes' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'comments', label: 'Comments' },
  { key: 'calls', label: 'Calls' },
  { key: 'emails', label: 'Emails' },
  { key: 'relationships', label: 'Relationships' },
  { key: 'files', label: 'Files' },
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

function renderEmptyValue(attribute: CrmAttribute) {
  return <span className="text-gray-400">Set {attribute.name}...</span>;
}

function renderDisplayValue(attribute: CrmAttribute, value: CrmRecordValue | undefined) {
  if (value === null || value === undefined || value === '') {
    return renderEmptyValue(attribute);
  }

  switch (attribute.type) {
    case 'URL': {
      const url = formatScalar(value);

      if (!url) {
        return renderEmptyValue(attribute);
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
        return renderEmptyValue(attribute);
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
        return renderEmptyValue(attribute);
      }

      return <div className="flex min-w-0 flex-wrap gap-1">{labels.map(renderTag)}</div>;
    }

    case 'BOOLEAN': {
      const checked = value === true || value === 'true' || value === 1 || value === '1';

      return checked ? (
        <span className="text-gray-900">Yes</span>
      ) : (
        <span className="text-gray-400">No</span>
      );
    }

    case 'DATE': {
      const date = formatDate(value);
      return date ? <span className="truncate text-gray-900">{date}</span> : renderEmptyValue(attribute);
    }

    case 'CURRENCY': {
      const text = formatCurrency(value);
      return text ? <span className="truncate text-gray-900" title={text}>{text}</span> : renderEmptyValue(attribute);
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
        renderEmptyValue(attribute)
      );
    }
  }
}

export default function RecordPage({ params }: PageProps) {
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

  async function loadRecord() {
    setIsLoading(true);
    setLoadError(null);

    try {
      const [objectData, recordData] = await Promise.all([getObject(objectKey), getRecord(recordId)]);
      setObject(objectData);
      setRecord(recordData);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Не удалось загрузить запись.');
    } finally {
      setIsLoading(false);
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
      setSaveError(err instanceof Error ? err.message : 'Не удалось сохранить значение.');
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
          <span className="text-[13px] text-gray-700">{checked ? 'Yes' : 'No'}</span>
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
          <option value="">Unset</option>
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
      case 'RECORD_CREATED': return 'Запись создана';
      case 'RECORD_UPDATED': return 'Запись обновлена';
      case 'RECORD_ARCHIVED': return 'Запись архивирована';
      default: return type.replace(/_/g, ' ').toLowerCase();
    }
  }

  function renderTabContent() {
    if (activeTab === 'overview') {
      return (
        <div className="min-h-[360px] px-4 py-4">
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-gray-400">Highlights</h2>
          {highlights.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-[13px] text-gray-500">
              No highlighted fields yet — fill in details on the right and they’ll surface here.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {highlights.map((attribute) => (
                <div key={attribute.id} className="min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <div className="truncate text-[11px] font-medium uppercase tracking-[0.04em] text-gray-400" title={attribute.name}>{attribute.name}</div>
                  <div className="mt-0.5 min-w-0 text-[13px] text-gray-900">{renderDisplayValue(attribute, record!.values?.[attribute.key])}</div>
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 text-[12px] text-gray-400">All fields are editable in the Details panel on the right. Activity, notes and more are in their tabs.</p>
        </div>
      );
    }

    if (activeTab === 'activity') {
      if (activitiesLoading) {
        return (
          <div className="flex h-full min-h-[360px] items-center justify-center text-[13px] text-gray-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-gray-400" />
            Загрузка истории…
          </div>
        );
      }

      if (!activities.length) {
        return (
          <div className="flex h-full min-h-[360px] items-center justify-center text-[13px] text-gray-500">
            <div className="text-center">
              <Activity className="mx-auto mb-2 h-5 w-5 text-gray-300" />
              <div>История активностей пуста</div>
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
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200"><Lock className="h-2.5 w-2.5" /> Restricted</span>
                    ) : null}
                    <span className="text-[12px] text-gray-400">
                      {new Intl.DateTimeFormat('ru', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(activity.createdAt))}
                    </span>
                  </div>

                  {activity.actor ? (
                    <div className="mt-0.5 text-[12px] text-gray-500">{activity.actor.name ?? activity.actor.email}</div>
                  ) : null}

                  {activity.redacted ? (
                    <div className="mt-1 text-[12px] italic text-gray-400">You don’t have access to the related item.</div>
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
          <p className="text-[13px] font-medium text-gray-600">File storage isn’t connected yet</p>
          <p className="mt-1 text-[12px] text-gray-400">Attachments will live here once a storage provider is connected. No files are stored on records today.</p>
        </div>
      </div>
    );

    return (
      <div className="flex h-full min-h-[360px] items-center justify-center text-[13px] text-gray-500">
        Нет данных
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center bg-white text-[13px] text-gray-600">
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-gray-400" />
        Loading...
      </div>
    );
  }

  if (loadError || !object || !record) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center bg-white px-6 text-center">
        <div>
          <div className="text-[14px] font-semibold text-gray-950">Не удалось открыть запись</div>
          <div className="mt-1 text-[13px] text-gray-500">{loadError ?? 'Запись не найдена.'}</div>
          <button
            type="button"
            onClick={() => void loadRecord()}
            className="mt-4 h-8 rounded-md border border-gray-200 bg-white px-3 text-[13px] font-medium text-gray-700 hover:bg-gray-50"
          >
            Повторить
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
                  <span>{tab.label}</span>
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
              Details
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
                Record Details
              </button>

              <div className={`pb-2 ${detailsOpen ? '' : 'hidden'}`}>
                {attributes.map((attribute) => {
                  const value = record.values?.[attribute.key];
                  const isEditing = editingKey === attribute.key;
                  const isSaving = savingKey === attribute.key;

                  return (
                    <div
                      key={attribute.id}
                      className="grid grid-cols-[128px_minmax(0,1fr)] gap-3 px-4 py-2 hover:bg-gray-50"
                    >
                      <div className="flex min-w-0 items-center gap-1.5 text-[12px] text-gray-500">
                        <span className="h-3.5 w-3.5 shrink-0 rounded-sm border border-gray-200 bg-white" />
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
                            {renderDisplayValue(attribute, value)}
                          </div>
                        )}

                        {isSaving ? (
                          <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-gray-400">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Saving
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
                System
              </button>

              <div className={`pb-2 ${systemOpen ? '' : 'hidden'}`}>
                <div className="grid grid-cols-[128px_minmax(0,1fr)] gap-3 px-4 py-2">
                  <div className="text-[12px] text-gray-500">Record ID</div>
                  <div className="truncate text-[13px] text-gray-900" title={record.id}>
                    {record.id}
                  </div>
                </div>

                <div className="grid grid-cols-[128px_minmax(0,1fr)] gap-3 px-4 py-2">
                  <div className="text-[12px] text-gray-500">Created</div>
                  <div className="truncate text-[13px] text-gray-900">
                    {record.createdAt ? formatDate(record.createdAt) : '—'}
                  </div>
                </div>

                <div className="grid grid-cols-[128px_minmax(0,1fr)] gap-3 px-4 py-2">
                  <div className="text-[12px] text-gray-500">Updated</div>
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
    </div>
  );
}