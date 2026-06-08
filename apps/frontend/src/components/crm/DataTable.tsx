'use client';

import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, Plus, X } from 'lucide-react';
import {
  createRecord,
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
  onRefresh: () => Promise<void> | void;
}

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
      className={`inline-flex max-w-[170px] items-center truncate rounded-md px-1.5 py-0.5 text-[12px] font-medium ring-1 ring-inset ${className}`}
      title={label}
    >
      {label}
    </span>
  );
}

function renderEmptyCell() {
  return <span className="text-gray-300">—</span>;
}

function renderCell(attribute: CrmAttribute, record: CrmRecord) {
  const rawValue = record.values?.[attribute.key];

  if (attribute.isPrimary) {
    const label = record.displayName || formatScalar(rawValue);

    return label ? (
      <span className="font-medium text-gray-950">{label}</span>
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
          className="truncate text-blue-700 underline-offset-2 hover:underline"
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
          className="truncate text-blue-700 underline-offset-2 hover:underline"
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

export default function DataTable({
  object,
  records,
  pagination,
  isLoading = false,
  newRecordSignal = 0,
  columns = [],
  onRefresh,
}: DataTableProps) {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [primaryValue, setPrimaryValue] = useState('');
  const [booleanPrimaryValue, setBooleanPrimaryValue] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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

  return (
    <div className="flex h-full min-h-0 flex-col bg-white text-[13px] text-gray-800">
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-max border-separate border-spacing-0 text-left">
          <thead className="sticky top-0 z-10 bg-white">
            <tr>
              <th className="h-9 w-9 border-b border-r border-gray-200 bg-white px-3">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600"
                />
              </th>

              {visibleAttributes.map((attribute) => (
                <th
                  key={attribute.id}
                  className={[
                    'h-9 border-b border-r border-gray-200 bg-white px-3 text-[13px] font-medium text-gray-700',
                    attribute.isPrimary ? 'min-w-[220px]' : 'min-w-[170px]',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{attribute.name}</span>
                    {attribute.isPrimary ? (
                      <Plus className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    ) : (
                      <span className="h-3.5 w-3.5 shrink-0 rounded-sm border border-gray-200" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {records.map((record) => (
              <tr
                key={record.id}
                role="button"
                tabIndex={0}
                onClick={() => openRecord(record)}
                onKeyDown={(event) => handleRowKeyDown(event, record)}
                className="group cursor-pointer outline-none hover:bg-gray-50 focus:bg-gray-50"
              >
                <td className="h-9 w-9 border-b border-r border-gray-100 bg-white px-3 group-hover:bg-gray-50 group-focus:bg-gray-50">
                  <input
                    type="checkbox"
                    aria-label={`Select ${record.displayName}`}
                    onClick={(event) => event.stopPropagation()}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600"
                  />
                </td>

                {visibleAttributes.map((attribute) => (
                  <td
                    key={`${record.id}-${attribute.id}`}
                    className={[
                      'h-9 max-w-[280px] border-b border-r border-gray-100 px-3 align-middle',
                      attribute.isPrimary
                        ? 'bg-white group-hover:bg-gray-50 group-focus:bg-gray-50'
                        : 'bg-white group-hover:bg-gray-50 group-focus:bg-gray-50',
                    ].join(' ')}
                  >
                    <div className="flex min-w-0 items-center overflow-hidden">
                      {renderCell(attribute, record)}
                    </div>
                  </td>
                ))}
              </tr>
            ))}

            {!isLoading && records.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleAttributes.length + 1}
                  className="h-28 border-b border-gray-100 px-4 text-center text-[13px] text-gray-500"
                >
                  В этом объекте пока нет записей.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>

        {isLoading ? (
          <div className="absolute inset-x-[220px] top-28 flex justify-center">
            <div className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[12px] text-gray-600 shadow-sm">
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              Обновление…
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex h-10 shrink-0 items-center border-t border-gray-200 bg-white text-[12px] text-gray-500">
        <div className="flex h-full w-[220px] items-center justify-end border-r border-gray-200 px-4 font-medium text-gray-700">
          {pagination?.total ?? records.length} count
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="flex h-full items-center gap-1 border-r border-gray-200 px-4 text-gray-500 hover:bg-gray-50 hover:text-gray-800"
        >
          <Plus className="h-3.5 w-3.5" />
          New
        </button>

        <div className="flex h-full min-w-[180px] items-center justify-center border-r border-gray-200 px-4">
          + Add calculation
        </div>

        <div className="flex h-full min-w-[180px] items-center justify-center border-r border-gray-200 px-4">
          + Add calculation
        </div>

        <div className="flex h-full min-w-[180px] items-center justify-center border-r border-gray-200 px-4">
          + Add calculation
        </div>
      </div>

      {isCreateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/20 px-4">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-xl">
            <div className="flex h-12 items-center justify-between border-b border-gray-200 px-4">
              <div>
                <h2 className="text-[14px] font-semibold text-gray-950">
                  New {object.singularName}
                </h2>
                <p className="text-[12px] text-gray-500">Создание записи в {object.pluralName}</p>
              </div>

              <button
                type="button"
                onClick={closeCreateModal}
                className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRecord} className="p-4">
              {primaryAttribute ? (
                <label className="block">
                  <span className="text-[13px] font-medium text-gray-800">
                    {primaryAttribute.name}
                  </span>

                  {primaryAttribute.type === 'BOOLEAN' ? (
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={booleanPrimaryValue}
                        onChange={(event) => setBooleanPrimaryValue(event.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600"
                      />
                      <span className="text-[13px] text-gray-700">Да</span>
                    </div>
                  ) : (
                    <input
                      type={getInputType(primaryAttribute)}
                      value={primaryValue}
                      onChange={(event) => setPrimaryValue(event.target.value)}
                      placeholder={`Введите ${primaryAttribute.name.toLowerCase()}`}
                      className="mt-2 h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-[13px] text-gray-900 outline-none ring-blue-100 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2"
                    />
                  )}
                </label>
              ) : (
                <p className="text-[13px] text-gray-600">У объекта нет доступных атрибутов.</p>
              )}

              {createError ? (
                <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
                  {createError}
                </div>
              ) : null}

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  disabled={isSaving}
                  className="h-8 rounded-md border border-gray-200 bg-white px-3 text-[13px] font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSaving || !primaryAttribute}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-[13px] font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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