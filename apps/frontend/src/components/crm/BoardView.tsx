'use client';

import { CSSProperties, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  closestCorners,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Building2,
  Clock3,
  DollarSign,
  GripVertical,
  Loader2,
  Plus,
  UserRound,
} from 'lucide-react';
import {
  updateRecord,
  type CrmObjectDetail,
  type CrmRecord,
} from '@/lib/crmApi';

type BoardViewProps = {
  object: CrmObjectDetail;
  records: CrmRecord[];
  onRecordsChange?: (records: CrmRecord[]) => void;
  onCreateRecord?: () => void;
};

type BoardAttributeOption = {
  id?: string;
  value?: string;
  name?: string;
  label?: string;
  color?: string;
};

type BoardAttribute = {
  id?: string;
  key: string;
  name: string;
  type?: string;
  options?: BoardAttributeOption[];
};

type BoardColumn = {
  id: string;
  title: string;
  value: string | null;
  colorClassName: string;
  records: CrmRecord[];
};

type Highlight = {
  id: string;
  label: string;
  value: string;
  type: 'money' | 'company' | 'person' | 'default';
};

type DndData = {
  type?: 'column' | 'record';
  columnValue?: string | null;
  recordId?: string;
};

const DOT_COLORS = [
  'bg-yellow-400',
  'bg-pink-500',
  'bg-lime-400',
  'bg-gray-300',
  'bg-cyan-400',
  'bg-violet-500',
  'bg-orange-400',
  'bg-emerald-400',
  'bg-blue-400',
  'bg-rose-400',
];

function getObjectKey(object: CrmObjectDetail): string {
  const value = object as CrmObjectDetail & { key?: string; objectKey?: string };
  return value.key ?? value.objectKey ?? '';
}

function getRecordValues(record: CrmRecord): Record<string, unknown> {
  const value = record as CrmRecord & { values?: Record<string, unknown> };
  return value.values ?? {};
}

function getRecordDisplayName(record: CrmRecord): string {
  const value = record as CrmRecord & { displayName?: string };
  return value.displayName?.trim() || 'Untitled';
}

function normalizeValue(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }

  if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
    return String(raw);
  }

  if (Array.isArray(raw)) {
    const first = raw[0];
    return normalizeValue(first);
  }

  if (typeof raw === 'object') {
    const value = raw as { value?: unknown; id?: unknown; name?: unknown; displayName?: unknown };
    return normalizeValue(value.value ?? value.id ?? value.name ?? value.displayName);
  }

  return null;
}

function isEmptyValue(raw: unknown): boolean {
  if (raw === null || raw === undefined || raw === '') {
    return true;
  }

  if (Array.isArray(raw)) {
    return raw.length === 0;
  }

  return false;
}

function humanizeKey(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatValue(raw: unknown, attribute?: BoardAttribute): string {
  if (isEmptyValue(raw)) {
    return '';
  }

  const type = attribute?.type?.toUpperCase();

  if (type === 'CURRENCY') {
    const numberValue = typeof raw === 'number' ? raw : Number(String(raw).replace(/[^\d.-]/g, ''));

    if (Number.isFinite(numberValue)) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(numberValue);
    }
  }

  if (type === 'NUMBER') {
    const numberValue = typeof raw === 'number' ? raw : Number(raw);

    if (Number.isFinite(numberValue)) {
      return new Intl.NumberFormat('en-US').format(numberValue);
    }
  }

  if (Array.isArray(raw)) {
    return raw.map((item) => formatValue(item, attribute)).filter(Boolean).join(', ');
  }

  if (typeof raw === 'object') {
    const value = raw as {
      displayName?: unknown;
      name?: unknown;
      label?: unknown;
      value?: unknown;
      email?: unknown;
    };

    return String(value.displayName ?? value.name ?? value.label ?? value.value ?? value.email ?? '');
  }

  return String(raw);
}

function getOptionTitle(option: BoardAttributeOption): string {
  const rawValue = option.name ?? option.label ?? option.value ?? option.id ?? 'No stage';
  return humanizeKey(String(rawValue));
}

function getOptionValue(option: BoardAttributeOption): string {
  return String(option.value ?? option.id ?? getOptionTitle(option));
}

function isSelectAttribute(attribute: BoardAttribute): boolean {
  return attribute.type?.toUpperCase() === 'SELECT' && Boolean(attribute.options?.length);
}

function findGroupAttribute(attributes: BoardAttribute[]): BoardAttribute | null {
  const selectAttributes = attributes.filter(isSelectAttribute);

  return (
    selectAttributes.find((attribute) => attribute.key === 'stage') ??
    selectAttributes.find((attribute) => attribute.name.toLowerCase() === 'stage') ??
    selectAttributes[0] ??
    null
  );
}

function getColumns(records: CrmRecord[], groupAttribute: BoardAttribute): BoardColumn[] {
  const options = groupAttribute.options ?? [];
  const stageValues = new Set(options.map(getOptionValue));

  const noStageRecords = records.filter((record) => {
    const value = normalizeValue(getRecordValues(record)[groupAttribute.key]);
    return value === null || !stageValues.has(value);
  });

  const stageColumns = options.map((option, index) => {
    const optionValue = getOptionValue(option);

    return {
      id: `stage:${optionValue}`,
      title: getOptionTitle(option),
      value: optionValue,
      colorClassName: DOT_COLORS[index % DOT_COLORS.length],
      records: records.filter((record) => normalizeValue(getRecordValues(record)[groupAttribute.key]) === optionValue),
    };
  });

  return [
    {
      id: 'stage:none',
      title: 'No stage',
      value: null,
      colorClassName: 'bg-gray-300',
      records: noStageRecords,
    },
    ...stageColumns,
  ];
}

function isMoneyAttribute(attribute: BoardAttribute): boolean {
  const key = attribute.key.toLowerCase();
  const name = attribute.name.toLowerCase();
  const type = attribute.type?.toUpperCase();

  return (
    type === 'CURRENCY' ||
    key.includes('amount') ||
    key.includes('value') ||
    key.includes('revenue') ||
    key.includes('price') ||
    name.includes('amount') ||
    name.includes('value') ||
    name.includes('revenue')
  );
}

function isCompanyAttribute(attribute: BoardAttribute): boolean {
  const key = attribute.key.toLowerCase();
  const name = attribute.name.toLowerCase();

  return (
    key.includes('company') ||
    key.includes('account') ||
    key.includes('organization') ||
    key.includes('org') ||
    name.includes('company') ||
    name.includes('account') ||
    name.includes('organization')
  );
}

function isPersonAttribute(attribute: BoardAttribute): boolean {
  const key = attribute.key.toLowerCase();
  const name = attribute.name.toLowerCase();

  return (
    key.includes('owner') ||
    key.includes('person') ||
    key.includes('people') ||
    key.includes('contact') ||
    key.includes('poc') ||
    key.includes('assignee') ||
    name.includes('owner') ||
    name.includes('person') ||
    name.includes('people') ||
    name.includes('contact') ||
    name.includes('poc') ||
    name.includes('assignee')
  );
}

function buildHighlights(
  record: CrmRecord,
  attributes: BoardAttribute[],
  groupKey: string,
): Highlight[] {
  const values = getRecordValues(record);
  const availableAttributes = attributes.filter((attribute) => attribute.key !== groupKey);
  const highlights: Highlight[] = [];

  const addHighlight = (attribute: BoardAttribute, type: Highlight['type']) => {
    const rawValue = values[attribute.key];

    if (isEmptyValue(rawValue) || highlights.some((highlight) => highlight.id === attribute.key)) {
      return;
    }

    const formatted = formatValue(rawValue, attribute);

    if (!formatted) {
      return;
    }

    highlights.push({
      id: attribute.key,
      label: attribute.name,
      value: formatted,
      type,
    });
  };

  availableAttributes.filter(isMoneyAttribute).forEach((attribute) => addHighlight(attribute, 'money'));
  availableAttributes.filter(isCompanyAttribute).forEach((attribute) => addHighlight(attribute, 'company'));
  availableAttributes.filter(isPersonAttribute).forEach((attribute) => addHighlight(attribute, 'person'));

  availableAttributes.forEach((attribute) => {
    if (highlights.length >= 4) {
      return;
    }

    addHighlight(attribute, 'default');
  });

  return highlights.slice(0, 4);
}

function getInitials(value: string): string {
  const words = value
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return '?';
  }

  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

function HighlightIcon({ type }: { type: Highlight['type'] }) {
  if (type === 'money') {
    return <DollarSign className="h-3.5 w-3.5 text-gray-400" />;
  }

  if (type === 'company') {
    return <Building2 className="h-3.5 w-3.5 text-gray-400" />;
  }

  if (type === 'person') {
    return <UserRound className="h-3.5 w-3.5 text-gray-400" />;
  }

  return <span className="h-3.5 w-3.5 rounded-full border border-gray-300 bg-gray-50" />;
}

function DealCardInner({
  record,
  objectKey,
  attributes,
  groupKey,
  isOverlay = false,
}: {
  record: CrmRecord;
  objectKey: string;
  attributes: BoardAttribute[];
  groupKey: string;
  isOverlay?: boolean;
}) {
  const displayName = getRecordDisplayName(record);
  const highlights = buildHighlights(record, attributes, groupKey);
  const peopleHighlights = highlights.filter((highlight) => highlight.type === 'person').slice(0, 3);
  const href = objectKey ? `/crm/${objectKey}/${record.id}` : '#';

  return (
    <Link
      href={href}
      className={[
        'block rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[13px] shadow-sm outline-none transition',
        'hover:border-gray-300 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-500',
        isOverlay ? 'w-[252px] rotate-1 cursor-grabbing shadow-lg' : '',
      ].join(' ')}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gray-100">
          <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
        </span>
        <span className="truncate font-semibold text-gray-950">{displayName}</span>
      </div>

      {highlights.length > 0 ? (
        <div className="mt-2 space-y-1.5">
          {highlights.slice(0, 3).map((highlight) => (
            <div key={highlight.id} className="flex min-w-0 items-center gap-2 text-gray-700">
              <HighlightIcon type={highlight.type} />
              <span className="truncate">{highlight.value}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-2 text-[12px] text-gray-400">No visible fields</div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {peopleHighlights.length > 0 ? (
            peopleHighlights.map((highlight) => (
              <span
                key={highlight.id}
                title={highlight.value}
                className="inline-flex h-5 max-w-[92px] items-center gap-1 rounded-md bg-gray-100 px-1.5 text-[11px] text-gray-700"
              >
                <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-white text-[8px] font-semibold text-gray-500 ring-1 ring-gray-200">
                  {getInitials(highlight.value)}
                </span>
                <span className="truncate">{highlight.value}</span>
              </span>
            ))
          ) : (
            <span className="text-[11px] text-gray-400">No owner</span>
          )}
        </div>

        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-gray-400">
          <Clock3 className="h-3.5 w-3.5" />
          0d
        </span>
      </div>
    </Link>
  );
}

function SortableDealCard({
  record,
  objectKey,
  attributes,
  groupKey,
  columnValue,
}: {
  record: CrmRecord;
  objectKey: string;
  attributes: BoardAttribute[];
  groupKey: string;
  columnValue: string | null;
}) {
  const {
    attributes: sortableAttributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: record.id,
    data: {
      type: 'record',
      recordId: record.id,
      columnValue,
    } satisfies DndData,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? 'opacity-40' : ''}
      {...sortableAttributes}
      {...listeners}
    >
      <div className="group relative">
        <span className="pointer-events-none absolute right-2 top-2 hidden text-gray-300 group-hover:block">
          <GripVertical className="h-3.5 w-3.5" />
        </span>
        <DealCardInner
          record={record}
          objectKey={objectKey}
          attributes={attributes}
          groupKey={groupKey}
        />
      </div>
    </div>
  );
}

function BoardColumnView({
  column,
  object,
  objectKey,
  attributes,
  groupKey,
  onCreateRecord,
}: {
  column: BoardColumn;
  object: CrmObjectDetail;
  objectKey: string;
  attributes: BoardAttribute[];
  groupKey: string;
  onCreateRecord?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: {
      type: 'column',
      columnValue: column.value,
    } satisfies DndData,
  });

  const singularName = (object as CrmObjectDetail & { singularName?: string }).singularName ?? 'record';

  return (
    <section className="flex h-full w-[268px] min-w-[268px] flex-col">
      <div className="sticky top-0 z-10 bg-white pb-2">
        <div className="flex h-9 items-center justify-between gap-2 px-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className={`h-3 w-3 shrink-0 rounded-full ${column.colorClassName}`} />
            <span className="truncate text-[13px] font-semibold text-gray-900">{column.title}</span>
            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">
              {column.records.length}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onCreateRecord}
          className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-200 bg-white text-[13px] text-gray-500 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700"
        >
          <Plus className="h-3.5 w-3.5" />
          New {singularName}
        </button>
      </div>

      <div
        ref={setNodeRef}
        className={[
          'min-h-[calc(100vh-220px)] flex-1 rounded-lg p-1 transition',
          isOver ? 'bg-blue-50/70 ring-1 ring-blue-100' : 'bg-white',
        ].join(' ')}
      >
        <SortableContext
          items={column.records.map((record) => record.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {column.records.map((record) => (
              <SortableDealCard
                key={record.id}
                record={record}
                objectKey={objectKey}
                attributes={attributes}
                groupKey={groupKey}
                columnValue={column.value}
              />
            ))}
          </div>
        </SortableContext>
      </div>
    </section>
  );
}

export default function BoardView({
  object,
  records,
  onRecordsChange,
  onCreateRecord,
}: BoardViewProps) {
  const objectKey = getObjectKey(object);
  const attributes = useMemo(
    () => ((object as CrmObjectDetail & { attributes?: BoardAttribute[] }).attributes ?? []),
    [object],
  );
  const groupAttribute = useMemo(() => findGroupAttribute(attributes), [attributes]);

  const [localRecords, setLocalRecords] = useState(records);
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
  );

  useEffect(() => {
    setLocalRecords(records);
  }, [records]);

  const columns = useMemo(() => {
    if (!groupAttribute) {
      return [];
    }

    return getColumns(localRecords, groupAttribute);
  }, [groupAttribute, localRecords]);

  const activeRecord = useMemo(
    () => localRecords.find((record) => record.id === activeRecordId) ?? null,
    [activeRecordId, localRecords],
  );

  const publishRecords = useCallback(
    (nextRecords: CrmRecord[]) => {
      setLocalRecords(nextRecords);
      onRecordsChange?.(nextRecords);
    },
    [onRecordsChange],
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setError(null);
    setActiveRecordId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveRecordId(null);

      if (!groupAttribute || !event.over) {
        return;
      }

      const activeId = String(event.active.id);
      const activeRecordForMove = localRecords.find((record) => record.id === activeId);

      if (!activeRecordForMove) {
        return;
      }

      const overData = event.over.data.current as DndData | undefined;

      if (!overData || !Object.prototype.hasOwnProperty.call(overData, 'columnValue')) {
        return;
      }

      const nextStageValue = overData.columnValue ?? null;
      const currentStageValue = normalizeValue(getRecordValues(activeRecordForMove)[groupAttribute.key]);

      if (currentStageValue === nextStageValue) {
        return;
      }

      const previousRecords = localRecords;
      const nextRecords = localRecords.map((record) => {
        if (record.id !== activeRecordForMove.id) {
          return record;
        }

        return {
          ...record,
          values: {
            ...getRecordValues(record),
            [groupAttribute.key]: nextStageValue,
          },
        } as CrmRecord;
      });

      publishRecords(nextRecords);
      setIsUpdating(true);
      setError(null);

      try {
        await updateRecord(activeRecordForMove.id, {
          [groupAttribute.key]: nextStageValue,
        });
      } catch (err) {
        publishRecords(previousRecords);
        setError(err instanceof Error ? err.message : 'Не удалось обновить стадию сделки.');
      } finally {
        setIsUpdating(false);
      }
    },
    [groupAttribute, localRecords, publishRecords],
  );

  if (!groupAttribute) {
    return (
      <div className="flex h-full items-center justify-center bg-white px-6">
        <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <h2 className="text-[15px] font-semibold text-gray-950">
            Board доступен только для объектов со стадией
          </h2>
          <p className="mt-2 text-[13px] leading-5 text-gray-600">
            Добавьте SELECT-атрибут Stage или другой SELECT-атрибут, чтобы сгруппировать записи по колонкам.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-gray-100 px-4">
        <div className="flex min-w-0 items-center gap-2 text-[13px] text-gray-600">
          <span>Grouped by</span>
          <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 font-medium text-gray-800">
            {groupAttribute.name}
          </span>
        </div>

        {isUpdating ? (
          <div className="flex items-center gap-1.5 text-[12px] text-gray-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Saving
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-[13px] text-amber-800">
          {error}
        </div>
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveRecordId(null)}
      >
        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex h-full min-w-max items-start gap-3 px-4 py-3">
            {columns.map((column) => (
              <BoardColumnView
                key={column.id}
                column={column}
                object={object}
                objectKey={objectKey}
                attributes={attributes}
                groupKey={groupAttribute.key}
                onCreateRecord={onCreateRecord}
              />
            ))}
          </div>
        </div>

        <DragOverlay>
          {activeRecord ? (
            <DealCardInner
              record={activeRecord}
              objectKey={objectKey}
              attributes={attributes}
              groupKey={groupAttribute.key}
              isOverlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}