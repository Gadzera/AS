'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import { Archive, Check, Loader2, Plus, Search, Sparkles, X, Zap } from 'lucide-react';
import BulkProductivityModal from '@/components/data/BulkProductivityModal';
import {
  bulkArchiveRecords,
  createRecord,
  updateRecord,
  type CrmAttribute,
  type CrmObjectDetail,
  type CrmRecord,
  type CrmRecordValue,
  type RecordsPagination,
  type CrmViewColumn,
} from '@/lib/crmApi';

interface DataTableProps {
  object: CrmObjectDetail;
  records: CrmRecord[];
  pagination?: RecordsPagination | null;
  isLoading?: boolean;
  newRecordSignal?: number;
  columns?: CrmViewColumn[];
  /** Строка поиска: управляется снаружи страницей объекта (S064) */
  searchQuery?: string;
  onRefresh: () => Promise<void> | void;
  /** Колбэк смены строки поиска — если передан, внутри таблицы не будет поля поиска */
  onSearchChange?: (query: string) => void;
}

// Палитра тегов SELECT / MULTI_SELECT — насыщенная (Bold)
const tagClasses = [
  'bg-indigo-100 text-indigo-700 ring-indigo-200',
  'bg-emerald-100 text-emerald-700 ring-emerald-200',
  'bg-sky-100 text-sky-700 ring-sky-200',
  'bg-violet-100 text-violet-700 ring-violet-200',
  'bg-pink-100 text-pink-700 ring-pink-200',
  'bg-amber-100 text-amber-700 ring-amber-200',
  'bg-rose-100 text-rose-700 ring-rose-200',
  'bg-fuchsia-100 text-fuchsia-700 ring-fuchsia-200',
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

function renderTag(label: string) {
  const className = tagClasses[hashText(label)];

  return (
    <span
      key={label}
      className={`inline-flex max-w-[170px] items-center truncate rounded-full px-2 py-0.5 text-[12px] font-semibold ring-1 ring-inset ${className}`}
      title={label}
    >
      {label}
    </span>
  );
}

function renderEmptyCell() {
  return <span className="text-ink-subtle/50">—</span>;
}

// Отображение ячейки в режиме чтения (S080)
function renderCell(attribute: CrmAttribute, record: CrmRecord) {
  const rawValue = record.values?.[attribute.key];

  if (attribute.isPrimary) {
    const label = record.displayName || formatScalar(rawValue);

    return label ? (
      <span className="font-semibold text-ink">{label}</span>
    ) : (
      renderEmptyCell()
    );
  }

  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return renderEmptyCell();
  }

  switch (attribute.type) {
    case 'URL': {
      const href = formatScalar(rawValue);

      return href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="truncate font-medium text-brand-700 underline-offset-2 hover:underline"
          title={href}
        >
          {href.replace(/^https?:\/\//, '')}
        </a>
      ) : (
        renderEmptyCell()
      );
    }

    case 'EMAIL': {
      const email = formatScalar(rawValue);

      return email ? (
        <a
          href={`mailto:${email}`}
          onClick={(event) => event.stopPropagation()}
          className="truncate font-medium text-brand-700 underline-offset-2 hover:underline"
          title={email}
        >
          {email}
        </a>
      ) : (
        renderEmptyCell()
      );
    }

    case 'SELECT':
    case 'MULTI_SELECT': {
      const labels = getTagLabels(rawValue);

      if (!labels.length) {
        return renderEmptyCell();
      }

      return <div className="flex max-w-[260px] flex-wrap gap-1">{labels.map(renderTag)}</div>;
    }

    case 'BOOLEAN': {
      const checked = rawValue === true || rawValue === 'true' || rawValue === 1 || rawValue === '1';

      return checked ? (
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200">
          <Check className="h-3.5 w-3.5" />
        </span>
      ) : (
        renderEmptyCell()
      );
    }

    case 'DATE':
      return formatDate(rawValue) ? (
        <span className="truncate text-gray-800">{formatDate(rawValue)}</span>
      ) : (
        renderEmptyCell()
      );

    case 'RELATIONSHIP':
    case 'LOCATION':
    case 'TEXT':
    case 'NUMBER':
    case 'CURRENCY':
    default: {
      const text = formatScalar(rawValue);

      return text ? (
        <span className="truncate text-gray-800" title={text}>
          {text}
        </span>
      ) : (
        renderEmptyCell()
      );
    }
  }
}

function normalizeValueForAttribute(attribute: CrmAttribute, value: string): CrmRecordValue {
  if (attribute.type === 'NUMBER' || attribute.type === 'CURRENCY') {
    const numberValue = Number(value);
    return Number.isNaN(numberValue) ? value : numberValue;
  }

  if (attribute.type === 'BOOLEAN') {
    return value === 'true';
  }

  return value;
}

function getInputType(attribute: CrmAttribute | undefined): string {
  if (!attribute) return 'text';
  if (attribute.type === 'EMAIL') return 'email';
  if (attribute.type === 'URL') return 'url';
  if (attribute.type === 'NUMBER' || attribute.type === 'CURRENCY') return 'number';
  if (attribute.type === 'DATE') return 'date';

  return 'text';
}

// ─── Редактор ячейки (inline-edit, S062) ─────────────────────────────────────

interface CellEditorProps {
  attribute: CrmAttribute;
  initialValue: unknown;
  onSave: (value: CrmRecordValue) => void;
  onCancel: () => void;
}

function CellEditor({ attribute, initialValue, onSave, onCancel }: CellEditorProps) {
  const [localValue, setLocalValue] = useState<string>(() => {
    if (initialValue === null || initialValue === undefined) return '';
    if (Array.isArray(initialValue)) return initialValue.join(', ');
    return String(initialValue);
  });
  const [boolValue, setBoolValue] = useState<boolean>(() => {
    return initialValue === true || initialValue === 'true' || initialValue === 1;
  });
  const inputRef = useRef<HTMLInputElement & HTMLSelectElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    if (inputRef.current && 'select' in inputRef.current) {
      inputRef.current.select();
    }
  }, []);

  function commitSave() {
    if (attribute.type === 'BOOLEAN') {
      onSave(boolValue);
      return;
    }

    if (attribute.type === 'SELECT') {
      onSave(localValue || null);
      return;
    }

    onSave(normalizeValueForAttribute(attribute, localValue));
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      onCancel();
      return;
    }

    if (event.key === 'Enter' && attribute.type !== 'LONG_TEXT') {
      event.preventDefault();
      commitSave();
    }
  }

  // Чекбокс для BOOLEAN
  if (attribute.type === 'BOOLEAN') {
    return (
      <div className="flex items-center gap-2 px-1">
        <input
          type="checkbox"
          ref={inputRef as React.Ref<HTMLInputElement>}
          checked={boolValue}
          onChange={(e) => setBoolValue(e.target.checked)}
          onKeyDown={handleKeyDown}
          onBlur={commitSave}
          className="h-4 w-4 rounded border-gray-300 text-blue-600"
          aria-label={attribute.name}
        />
      </div>
    );
  }

  // Select для SELECT-атрибута
  if (attribute.type === 'SELECT') {
    const options = attribute.options ?? attribute.config?.options ?? attribute.config?.choices ?? [];

    return (
      <select
        ref={inputRef as React.Ref<HTMLSelectElement>}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commitSave}
        className="h-8 w-full rounded-md border border-brand-400 bg-white px-1.5 text-[13px] text-ink outline-none ring-2 ring-brand-100 focus:ring-2"
      >
        <option value="">— пусто —</option>
        {(options as Array<{ value?: string; key?: string; label?: string; name?: string }>).map((opt) => {
          const val = opt.value ?? opt.key ?? '';
          const label = opt.label ?? opt.name ?? val;

          return (
            <option key={val} value={val}>
              {label}
            </option>
          );
        })}
      </select>
    );
  }

  // Текстовый/числовой/email/url/date инпут
  return (
    <input
      ref={inputRef as React.Ref<HTMLInputElement>}
      type={getInputType(attribute)}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={commitSave}
      className="h-8 w-full rounded-md border border-brand-400 bg-white px-2 text-[13px] text-ink outline-none ring-2 ring-brand-100"
      aria-label={attribute.name}
    />
  );
}

// ─── Основной компонент ───────────────────────────────────────────────────────

export default function DataTable({
  object,
  records,
  pagination,
  isLoading = false,
  newRecordSignal = 0,
  columns = [],
  searchQuery: externalSearchQuery,
  onRefresh,
  onSearchChange,
}: DataTableProps) {
  const router = useRouter();

  // Модальное окно «Создать запись»
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [primaryValue, setPrimaryValue] = useState('');
  const [booleanPrimaryValue, setBooleanPrimaryValue] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Inline-edit: { recordId, attributeKey } (S062)
  const [editingCell, setEditingCell] = useState<{ recordId: string; attributeKey: string } | null>(null);
  const [savingCell, setSavingCell] = useState<{ recordId: string; attributeKey: string } | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);

  // Выбор записей (S066)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false); // M28-4: панель массовых действий

  // Локальный поиск (когда onSearchChange не передан снаружи, S064)
  const [localSearch, setLocalSearch] = useState('');
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Эффективная строка поиска
  const effectiveSearch = externalSearchQuery ?? localSearch;

  // Отфильтрованные записи (если поиск управляется внутри)
  const displayRecords = useMemo(() => {
    if (onSearchChange || !effectiveSearch.trim()) {
      return records;
    }

    const q = effectiveSearch.toLowerCase();

    return records.filter((record) => {
      if (record.displayName?.toLowerCase().includes(q)) return true;

      if (record.values) {
        return Object.values(record.values).some((v) => {
          const text = formatScalar(v).toLowerCase();
          return text.includes(q);
        });
      }

      return false;
    });
  }, [records, effectiveSearch, onSearchChange]);

  const attributes = useMemo(() => {
    return [...object.attributes].sort((first, second) => {
      const firstOrder = typeof first.order === 'number' ? first.order : 0;
      const secondOrder = typeof second.order === 'number' ? second.order : 0;
      return firstOrder - secondOrder;
    });
  }, [object.attributes]);

  const visibleAttributes = useMemo(() => {
    if (!columns.length) {
      return attributes;
    }

    const attributeByKey = new Map(attributes.map((attribute) => [attribute.key, attribute]));
    const orderedAttributes = columns
      .filter((column) => column.isVisible !== false)
      .sort((first, second) => (first.order ?? 0) - (second.order ?? 0))
      .map((column) => attributeByKey.get(column.attributeKey))
      .filter((attribute): attribute is CrmAttribute => Boolean(attribute));

    return orderedAttributes.length ? orderedAttributes : attributes;
  }, [attributes, columns]);

  const primaryAttribute = useMemo(() => {
    return (
      attributes.find((attribute) => attribute.isPrimary) ??
      attributes.find((attribute) => attribute.type === 'TEXT') ??
      attributes[0]
    );
  }, [attributes]);

  // Статистика для footer (S092 — COUNT)
  const totalCount = pagination?.total ?? records.length;

  // ─── Навигация к записи ──────────────────────────────────────────────────

  function getRecordHref(record: CrmRecord): string {
    return `/crm/${encodeURIComponent(object.key)}/${encodeURIComponent(record.id)}`;
  }

  function openRecord(record: CrmRecord) {
    router.push(getRecordHref(record));
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, record: CrmRecord) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openRecord(record);
    }
  }

  // ─── Создание записи ─────────────────────────────────────────────────────

  function openCreateModal() {
    setPrimaryValue('');
    setBooleanPrimaryValue(false);
    setCreateError(null);
    setIsCreateOpen(true);
  }

  function closeCreateModal() {
    if (isSaving) return;

    setIsCreateOpen(false);
    setPrimaryValue('');
    setBooleanPrimaryValue(false);
    setCreateError(null);
  }

  useEffect(() => {
    if (newRecordSignal > 0) {
      openCreateModal();
    }
  }, [newRecordSignal]);

  async function handleCreateRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!primaryAttribute) {
      setCreateError('У объекта нет атрибутов для создания записи.');
      return;
    }

    if (primaryAttribute.type !== 'BOOLEAN' && !primaryValue.trim()) {
      setCreateError(`Заполните поле "${primaryAttribute.name}".`);
      return;
    }

    setIsSaving(true);
    setCreateError(null);

    try {
      const values: Record<string, CrmRecordValue> = {
        [primaryAttribute.key]:
          primaryAttribute.type === 'BOOLEAN'
            ? booleanPrimaryValue
            : normalizeValueForAttribute(primaryAttribute, primaryValue.trim()),
      };

      await createRecord(object.key, values);
      await onRefresh();

      setIsCreateOpen(false);
      setPrimaryValue('');
      setBooleanPrimaryValue(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Не удалось создать запись.');
    } finally {
      setIsSaving(false);
    }
  }

  // ─── Inline-edit (S062) ──────────────────────────────────────────────────

  function startEdit(record: CrmRecord, attribute: CrmAttribute) {
    // Не редактируем в системных/relationship атрибутах через таблицу
    if (attribute.type === 'RELATIONSHIP' || attribute.type === 'USER' || attribute.type === 'JSON') {
      openRecord(record);
      return;
    }

    setEditingCell({ recordId: record.id, attributeKey: attribute.key });
    setInlineError(null);
  }

  const handleCellSave = useCallback(
    async (record: CrmRecord, attribute: CrmAttribute, value: CrmRecordValue) => {
      // Если значение не изменилось — просто выходим из режима редактирования
      const existingRaw = record.values?.[attribute.key];
      const existingStr = existingRaw === null || existingRaw === undefined ? '' : String(existingRaw);
      const newStr = value === null || value === undefined ? '' : String(value);

      setEditingCell(null);

      if (existingStr === newStr) return;

      setSavingCell({ recordId: record.id, attributeKey: attribute.key });
      setInlineError(null);

      try {
        await updateRecord(record.id, { [attribute.key]: value });
        await onRefresh();
      } catch (err) {
        setInlineError(
          err instanceof Error ? err.message : 'Не удалось сохранить изменение.',
        );
      } finally {
        setSavingCell(null);
      }
    },
    [onRefresh],
  );

  function handleCellCancel() {
    setEditingCell(null);
  }

  // ─── Bulk select (S066) ──────────────────────────────────────────────────

  const allSelected = displayRecords.length > 0 && selectedIds.size === displayRecords.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayRecords.map((r) => r.id)));
    }
  }

  function toggleSelectRow(recordId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (next.has(recordId)) {
        next.delete(recordId);
      } else {
        next.add(recordId);
      }

      return next;
    });
  }

  async function handleBulkArchive() {
    if (selectedIds.size === 0) return;

    const confirmed = window.confirm(`Архивировать ${selectedIds.size} запись(-ей)?`);
    if (!confirmed) return;

    try {
      await bulkArchiveRecords(Array.from(selectedIds));
      setSelectedIds(new Set());
      await onRefresh();
    } catch (err) {
      setInlineError(
        err instanceof Error ? err.message : 'Не удалось архивировать записи.',
      );
    }
  }

  // ─── Локальный поиск с debounce (S064) ──────────────────────────────────

  function handleLocalSearchChange(value: string) {
    setLocalSearch(value);

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(() => {
      onSearchChange?.(value);
    }, 300);
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface text-[13px] text-ink-muted">
      {/* Toolbar поиска (S064) — только если нет внешнего onSearchChange */}
      {!onSearchChange ? (
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line bg-surface px-4">
          <div className="relative flex min-w-0 flex-1 max-w-xs items-center">
            <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-ink-subtle" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => handleLocalSearchChange(e.target.value)}
              placeholder={`Search ${object.pluralName}...`}
              className="h-8 w-full rounded-lg border border-line bg-surface pl-8 pr-3 text-[13px] text-ink outline-none placeholder:text-ink-subtle focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
            {localSearch ? (
              <button
                type="button"
                onClick={() => handleLocalSearchChange('')}
                className="absolute right-2 text-ink-subtle hover:text-ink"
                aria-label="Очистить поиск"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          {inlineError ? (
            <div className="ml-auto rounded-md bg-rose-50 px-2 py-1 text-[12px] text-rose-700">
              {inlineError}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Inline error (если поиск снаружи) */}
      {onSearchChange && inlineError ? (
        <div className="border-b border-rose-100 bg-rose-50 px-4 py-2 text-[12px] text-rose-700">
          {inlineError}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-max border-separate border-spacing-0 text-left">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="h-11 w-10 border-b border-line-strong/60 border-r bg-gradient-to-b from-surface to-surface-2 px-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={toggleSelectAll}
                  aria-label="Select all"
                  className="h-4 w-4 rounded border-line-strong text-brand-600 hover:border-brand-400 focus:ring-brand-200"
                />
              </th>

              {visibleAttributes.map((attribute) => (
                <th
                  key={attribute.id}
                  className={[
                    'h-11 border-b border-line-strong/60 border-r border-r-line bg-gradient-to-b from-surface to-surface-2 px-4 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-subtle',
                    attribute.isPrimary ? 'min-w-[220px]' : 'min-w-[170px]',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{attribute.name}</span>
                    {attribute.isPrimary ? (
                      <Plus className="h-3.5 w-3.5 shrink-0 text-ink-subtle" />
                    ) : (
                      <span className="h-3.5 w-3.5 shrink-0 rounded-sm border border-line-strong" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {displayRecords.map((record) => (
              <tr
                key={record.id}
                tabIndex={0}
                onKeyDown={(event) => handleRowKeyDown(event, record)}
                className={[
                  'group outline-none transition-colors hover:bg-brand-50/50 focus:bg-brand-50/50',
                  selectedIds.has(record.id) ? 'bg-brand-50' : '',
                ].join(' ')}
              >
                {/* Чекбокс (S066) */}
                <td
                  className="h-12 w-10 border-b border-r border-line/70 bg-surface px-3 group-hover:bg-brand-50/50 group-focus:bg-brand-50/50"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(record.id)}
                    onChange={() => toggleSelectRow(record.id)}
                    aria-label={`Select ${record.displayName ?? record.id}`}
                    className="h-4 w-4 rounded border-line-strong text-brand-600 hover:border-brand-400 focus:ring-brand-200"
                  />
                </td>

                {visibleAttributes.map((attribute) => {
                  const isEditing =
                    editingCell?.recordId === record.id &&
                    editingCell.attributeKey === attribute.key;
                  const isSavingThis =
                    savingCell?.recordId === record.id &&
                    savingCell.attributeKey === attribute.key;

                  return (
                    <td
                      key={`${record.id}-${attribute.id}`}
                      className={[
                        'h-12 max-w-[280px] border-b border-r border-line/70 align-middle bg-surface group-hover:bg-brand-50/50 group-focus:bg-brand-50/50',
                        isEditing
                          ? 'p-0'
                          : 'cursor-pointer px-4',
                        isSavingThis ? 'opacity-50' : '',
                      ].join(' ')}
                      onClick={() => {
                        if (isEditing) return;

                        // Первичный атрибут — переход на страницу записи
                        if (attribute.isPrimary) {
                          openRecord(record);
                          return;
                        }

                        startEdit(record, attribute);
                      }}
                    >
                      {isEditing ? (
                        <CellEditor
                          attribute={attribute}
                          initialValue={record.values?.[attribute.key]}
                          onSave={(value) => handleCellSave(record, attribute, value)}
                          onCancel={handleCellCancel}
                        />
                      ) : (
                        <div className="flex min-w-0 items-center gap-1 overflow-hidden">
                          {isSavingThis ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
                          ) : (
                            <>
                              {/* M25-2: маркер «Generated by AI» в ячейке AI-атрибута с заполненным значением */}
                              {attribute.aiEnabled &&
                                !attribute.isPrimary &&
                                (() => {
                                  const v = record.values?.[attribute.key];
                                  const present = v != null && v !== '' && !(Array.isArray(v) && v.length === 0);
                                  return present ? (
                                    <span
                                      className="inline-flex shrink-0"
                                      title="Generated by AI"
                                      aria-label="Generated by AI"
                                    >
                                      <Sparkles className="h-3 w-3 text-brand-500" />
                                    </span>
                                  ) : null;
                                })()}
                              {renderCell(attribute, record)}
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}

            {!isLoading && displayRecords.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleAttributes.length + 1}
                  className="h-28 border-b border-line px-4 text-center text-[13px] text-ink-subtle"
                >
                  {effectiveSearch
                    ? `По запросу «${effectiveSearch}» ничего не найдено.`
                    : 'В этом объекте пока нет записей.'}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>

        {isLoading ? (
          <div className="absolute inset-x-[220px] top-28 flex justify-center">
            <div className="inline-flex items-center rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] text-ink-muted shadow-sm">
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin text-brand-600" />
              Обновление…
            </div>
          </div>
        ) : null}
      </div>

      {/* Bulk action bar — появляется при выборе (S066) */}
      {selectedIds.size > 0 ? (
        <div className="flex h-11 shrink-0 items-center gap-3 border-t border-brand-200 bg-brand-50 px-4 text-[13px]">
          <span className="font-semibold text-brand-800">
            Выбрано: {selectedIds.size}
          </span>

          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-brand-200 bg-surface px-2.5 text-[12px] font-medium text-ink-muted hover:bg-surface-2"
          >
            <X className="h-3 w-3" />
            Снять выбор
          </button>

          {/* M28-4: массовые действия (Send email / Add to list / Enroll in sequence) */}
          <button
            type="button"
            onClick={() => setBulkOpen(true)}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-brand-300 bg-surface px-2.5 text-[12px] font-semibold text-brand-700 hover:bg-brand-50"
          >
            <Zap className="h-3 w-3" />
            Actions
          </button>

          <button
            type="button"
            onClick={handleBulkArchive}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-rose-200 bg-surface px-2.5 text-[12px] font-medium text-rose-700 hover:bg-rose-50"
          >
            <Archive className="h-3 w-3" />
            Архивировать
          </button>
        </div>
      ) : (
        // Footer: count + кнопка добавить + расчёты (S092)
        <div className="flex h-11 shrink-0 items-center border-t border-line bg-surface-2/60 text-[12px] text-ink-subtle">
          <div className="flex h-full w-[220px] items-center justify-end border-r border-line px-4 font-semibold text-ink-muted">
            {totalCount} count
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="flex h-full items-center gap-1 border-r border-line px-4 font-medium text-ink-muted hover:bg-brand-50/60 hover:text-brand-700"
          >
            <Plus className="h-3.5 w-3.5" />
            New
          </button>

          {/* Placeholder расчёта SUM для числовых/currency колонок (S092) */}
          <div className="flex h-full min-w-[180px] items-center justify-center border-r border-line px-4">
            + Add calculation
          </div>

          <div className="flex h-full min-w-[180px] items-center justify-center border-r border-line px-4">
            + Add calculation
          </div>

          <div className="flex h-full min-w-[180px] items-center justify-center border-r border-line px-4">
            + Add calculation
          </div>
        </div>
      )}

      {/* M28-4: панель массовых действий над выделенными записями */}
      {bulkOpen ? (
        <BulkProductivityModal
          recordIds={Array.from(selectedIds)}
          objectKey={object.key}
          objectName={object.singularName}
          onClose={() => setBulkOpen(false)}
          onDone={() => { setSelectedIds(new Set()); void onRefresh(); }}
        />
      ) : null}

      {/* Модальное окно: создание записи (S060) */}
      {isCreateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-line bg-surface shadow-lg">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div>
                <h2 className="text-[15px] font-bold text-ink">
                  New {object.singularName}
                </h2>
                <p className="text-[12px] text-ink-subtle">Создание записи в {object.pluralName}</p>
              </div>

              <button
                type="button"
                onClick={closeCreateModal}
                className="rounded-lg p-1.5 text-ink-subtle hover:bg-surface-2 hover:text-ink"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRecord} className="p-5">
              {primaryAttribute ? (
                <label className="block">
                  <span className="text-[13px] font-semibold text-ink">
                    {primaryAttribute.name}
                  </span>

                  {primaryAttribute.type === 'BOOLEAN' ? (
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={booleanPrimaryValue}
                        onChange={(event) => setBooleanPrimaryValue(event.target.checked)}
                        className="h-4 w-4 rounded border-line-strong text-brand-600 focus:ring-brand-200"
                      />
                      <span className="text-[13px] text-ink-muted">Да</span>
                    </div>
                  ) : (
                    <input
                      type={getInputType(primaryAttribute)}
                      value={primaryValue}
                      onChange={(event) => setPrimaryValue(event.target.value)}
                      placeholder={`Введите ${primaryAttribute.name.toLowerCase()}`}
                      className="mt-2 h-10 w-full rounded-lg border border-line bg-surface px-3 text-[13px] text-ink outline-none placeholder:text-ink-subtle focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                      // eslint-disable-next-line jsx-a11y/no-autofocus
                      autoFocus
                    />
                  )}
                </label>
              ) : (
                <p className="text-[13px] text-ink-muted">У объекта нет доступных атрибутов.</p>
              )}

              {createError ? (
                <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
                  {createError}
                </div>
              ) : null}

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  disabled={isSaving}
                  className="h-9 rounded-lg border border-line bg-surface px-4 text-[13px] font-medium text-ink-muted hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSaving || !primaryAttribute}
                  className="brand-gradient inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-[13px] font-semibold text-white shadow-brand hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
