'use client';

import { useMemo, useState } from 'react';
import {
  ChevronDown,
  EyeOff,
  Filter,
  GripVertical,
  Plus,
  Save,
  SlidersHorizontal,
  SortAsc,
  Trash2,
  X,
} from 'lucide-react';
import type {
  CrmAttribute,
  CrmFilterOp,
  CrmObjectDetail,
  CrmView,
  CrmViewColumn,
  CrmViewFilter,
  CrmViewSort,
  CrmViewType,
} from '@/lib/crmApi';

interface ViewFiltersProps {
  object: CrmObjectDetail;
  views: CrmView[];
  activeViewId: string | null;
  viewMode: CrmViewType;
  filters: CrmViewFilter[];
  sorts: CrmViewSort[];
  columns: CrmViewColumn[];
  isSaving?: boolean;
  onSelectView: (viewId: string) => void;
  onFiltersChange: (filters: CrmViewFilter[]) => void;
  onSortsChange: (sorts: CrmViewSort[]) => void;
  onColumnsChange: (columns: CrmViewColumn[]) => void;
  onSaveView: () => void;
  onSaveAsNew: () => void;
  onDeleteView: () => void;
}

type PanelKey = 'views' | 'filters' | 'sorts' | 'columns' | null;

const operatorLabels: Record<CrmFilterOp, string> = {
  eq: 'is',
  neq: 'is not',
  contains: 'contains',
  gt: 'greater than',
  lt: 'less than',
  in: 'in',
  is_empty: 'is empty',
  is_not_empty: 'is not empty',
};

const filterOperators: CrmFilterOp[] = ['eq', 'neq', 'contains', 'gt', 'lt', 'in', 'is_empty', 'is_not_empty'];

function sortAttributes(attributes: CrmAttribute[]): CrmAttribute[] {
  return [...attributes].sort((first, second) => {
    const firstOrder = typeof first.order === 'number' ? first.order : 0;
    const secondOrder = typeof second.order === 'number' ? second.order : 0;
    return firstOrder - secondOrder;
  });
}

function getOptionValue(option: { key?: string; value?: string; label?: string; name?: string }): string {
  return option.value ?? option.key ?? option.label ?? option.name ?? '';
}

function getOptionLabel(option: { key?: string; value?: string; label?: string; name?: string }): string {
  return option.label ?? option.name ?? option.value ?? option.key ?? '';
}

function defaultOperatorForAttribute(attribute: CrmAttribute | undefined): CrmFilterOp {
  if (!attribute) return 'contains';

  if (attribute.type === 'NUMBER' || attribute.type === 'CURRENCY' || attribute.type === 'DATE' || attribute.type === 'DATETIME') {
    return 'gt';
  }

  if (attribute.type === 'BOOLEAN' || attribute.type === 'SELECT' || attribute.type === 'MULTI_SELECT') {
    return 'eq';
  }

  return 'contains';
}

function buildDefaultColumns(attributes: CrmAttribute[]): CrmViewColumn[] {
  return sortAttributes(attributes).map((attribute, index) => ({
    attributeKey: attribute.key,
    attributeName: attribute.name,
    attributeType: attribute.type,
    order: index,
    isVisible: true,
  }));
}

function normalizeColumnOrder(columns: CrmViewColumn[]): CrmViewColumn[] {
  return columns.map((column, index) => ({
    ...column,
    order: index,
    isVisible: column.isVisible ?? true,
  }));
}

function renderFilterValueInput(
  attribute: CrmAttribute | undefined,
  filter: CrmViewFilter,
  onChange: (value: unknown) => void,
) {
  if (!attribute || filter.op === 'is_empty' || filter.op === 'is_not_empty') {
    return null;
  }

  if (attribute.type === 'BOOLEAN') {
    return (
      <select
        value={filter.value === true || filter.value === 'true' ? 'true' : 'false'}
        onChange={(event) => onChange(event.target.value === 'true')}
        className="h-8 rounded-md border border-gray-200 bg-white px-2 text-[13px] text-gray-800 outline-none focus:border-blue-500"
      >
        <option value="true">Да</option>
        <option value="false">Нет</option>
      </select>
    );
  }

  if (attribute.type === 'SELECT' || attribute.type === 'MULTI_SELECT') {
    const options = attribute.options ?? attribute.config?.options ?? attribute.config?.choices ?? [];

    return (
      <select
        value={String(filter.value ?? '')}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 min-w-[150px] rounded-md border border-gray-200 bg-white px-2 text-[13px] text-gray-800 outline-none focus:border-blue-500"
      >
        <option value="">Select value</option>
        {options.map((option) => {
          const value = getOptionValue(option);
          const label = getOptionLabel(option);

          return (
            <option key={value} value={value}>
              {label}
            </option>
          );
        })}
      </select>
    );
  }

  const inputType = attribute.type === 'NUMBER' || attribute.type === 'CURRENCY' ? 'number' : attribute.type === 'DATE' ? 'date' : 'text';

  return (
    <input
      type={inputType}
      value={String(filter.value ?? '')}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Value"
      className="h-8 min-w-[170px] rounded-md border border-gray-200 bg-white px-2 text-[13px] text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-500"
    />
  );
}

export default function ViewFilters({
  object,
  views,
  activeViewId,
  viewMode,
  filters,
  sorts,
  columns,
  isSaving = false,
  onSelectView,
  onFiltersChange,
  onSortsChange,
  onColumnsChange,
  onSaveView,
  onSaveAsNew,
  onDeleteView,
}: ViewFiltersProps) {
  const [openPanel, setOpenPanel] = useState<PanelKey>(null);

  const attributes = useMemo(() => sortAttributes(object.attributes), [object.attributes]);
  const attributeByKey = useMemo(
    () => new Map(attributes.map((attribute) => [attribute.key, attribute])),
    [attributes],
  );
  const activeView = useMemo(
    () => views.find((view) => view.id === activeViewId) ?? null,
    [activeViewId, views],
  );
  const visibleColumns = columns.length ? normalizeColumnOrder(columns.filter((column) => column.isVisible !== false)) : buildDefaultColumns(attributes);
  const visibleColumnKeys = new Set(visibleColumns.map((column) => column.attributeKey));
  const hiddenAttributes = attributes.filter((attribute) => !visibleColumnKeys.has(attribute.key));

  function togglePanel(panel: PanelKey) {
    setOpenPanel((current) => (current === panel ? null : panel));
  }

  function addFilter() {
    const attribute = attributes[0];
    if (!attribute) return;

    onFiltersChange([
      ...filters,
      {
        attributeKey: attribute.key,
        op: defaultOperatorForAttribute(attribute),
        value: attribute.type === 'BOOLEAN' ? true : '',
      },
    ]);
  }

  function updateFilter(index: number, patch: Partial<CrmViewFilter>) {
    onFiltersChange(
      filters.map((filter, filterIndex) => (filterIndex === index ? { ...filter, ...patch } : filter)),
    );
  }

  function removeFilter(index: number) {
    onFiltersChange(filters.filter((_filter, filterIndex) => filterIndex !== index));
  }

  function addSort() {
    const attribute = attributes[0];
    if (!attribute) return;

    onSortsChange([
      ...sorts,
      {
        attributeKey: attribute.key,
        dir: 'asc',
      },
    ]);
  }

  function updateSort(index: number, patch: Partial<CrmViewSort>) {
    onSortsChange(sorts.map((sort, sortIndex) => (sortIndex === index ? { ...sort, ...patch } : sort)));
  }

  function removeSort(index: number) {
    onSortsChange(sorts.filter((_sort, sortIndex) => sortIndex !== index));
  }

  function hideColumn(attributeKey: string) {
    if (visibleColumns.length <= 1) return;
    onColumnsChange(normalizeColumnOrder(visibleColumns.filter((column) => column.attributeKey !== attributeKey)));
  }

  function showColumn(attribute: CrmAttribute) {
    onColumnsChange(
      normalizeColumnOrder([
        ...visibleColumns,
        {
          attributeKey: attribute.key,
          attributeName: attribute.name,
          attributeType: attribute.type,
          isVisible: true,
        },
      ]),
    );
  }

  function moveColumn(attributeKey: string, direction: -1 | 1) {
    const nextColumns = [...visibleColumns];
    const currentIndex = nextColumns.findIndex((column) => column.attributeKey === attributeKey);
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= nextColumns.length) {
      return;
    }

    const [column] = nextColumns.splice(currentIndex, 1);
    nextColumns.splice(nextIndex, 0, column);
    onColumnsChange(normalizeColumnOrder(nextColumns));
  }

  return (
    <div className="relative flex h-11 items-center gap-2 border-t border-gray-100 px-4 text-[13px]">
      <button
        type="button"
        onClick={() => togglePanel('views')}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 font-medium text-gray-800 shadow-sm hover:bg-gray-50"
      >
        <span className={viewMode === 'board' ? 'h-2 w-2 rounded-sm bg-violet-500' : 'h-2 w-2 rounded-sm bg-emerald-500'} />
        {activeView?.name ?? `All ${object.pluralName}`}
        <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
      </button>

      <button
        type="button"
        onClick={() => togglePanel('filters')}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 text-gray-700 shadow-sm hover:bg-gray-50"
      >
        <Filter className="h-3.5 w-3.5" />
        Filter
        {filters.length ? (
          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">{filters.length}</span>
        ) : null}
      </button>

      <button
        type="button"
        onClick={() => togglePanel('sorts')}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 text-gray-700 shadow-sm hover:bg-gray-50"
      >
        <SortAsc className="h-3.5 w-3.5" />
        {sorts.length ? `Sorted by ${attributeByKey.get(sorts[0].attributeKey)?.name ?? sorts[0].attributeKey}` : 'Sort'}
        {sorts.length > 1 ? (
          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">+{sorts.length - 1}</span>
        ) : null}
      </button>

      <button
        type="button"
        onClick={() => togglePanel('columns')}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 text-gray-700 shadow-sm hover:bg-gray-50"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Columns
        <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">{visibleColumns.length}</span>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onSaveView}
          disabled={!activeViewId || isSaving}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          Save view
        </button>

        <button
          type="button"
          onClick={onSaveAsNew}
          disabled={isSaving}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-gray-950 px-2.5 font-medium text-white shadow-sm hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save as new
        </button>
      </div>

      {openPanel === 'views' ? (
        <div className="absolute left-4 top-10 z-30 w-72 rounded-xl border border-gray-200 bg-white p-2 shadow-xl">
          <div className="px-2 py-1.5 text-[12px] font-medium uppercase tracking-wide text-gray-500">Saved views</div>
          <div className="max-h-72 overflow-auto py-1">
            {views.map((view) => (
              <button
                key={view.id}
                type="button"
                onClick={() => {
                  onSelectView(view.id);
                  setOpenPanel(null);
                }}
                className={[
                  'flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-[13px] hover:bg-gray-50',
                  view.id === activeViewId ? 'bg-gray-50 font-medium text-gray-950' : 'text-gray-700',
                ].join(' ')}
              >
                <span className="truncate">{view.name}</span>
                <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">{view.type}</span>
              </button>
            ))}
          </div>

          {activeViewId ? (
            <button
              type="button"
              onClick={() => {
                onDeleteView();
                setOpenPanel(null);
              }}
              className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-2 text-[13px] text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete current view
            </button>
          ) : null}
        </div>
      ) : null}

      {openPanel === 'filters' ? (
        <div className="absolute left-4 top-10 z-30 w-[760px] rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <div className="text-[13px] font-semibold text-gray-950">Filters</div>
              <div className="text-[12px] text-gray-500">Все условия применяются через AND.</div>
            </div>
            <button type="button" onClick={() => setOpenPanel(null)} className="rounded-md p-1 text-gray-500 hover:bg-gray-100">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-2">
            {filters.map((filter, index) => {
              const attribute = attributeByKey.get(filter.attributeKey);

              return (
                <div key={`${filter.attributeKey}-${index}`} className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 p-2">
                  <select
                    value={filter.attributeKey}
                    onChange={(event) => {
                      const nextAttribute = attributeByKey.get(event.target.value);
                      updateFilter(index, {
                        attributeKey: event.target.value,
                        op: defaultOperatorForAttribute(nextAttribute),
                        value: nextAttribute?.type === 'BOOLEAN' ? true : '',
                      });
                    }}
                    className="h-8 min-w-[170px] rounded-md border border-gray-200 bg-white px-2 text-[13px] text-gray-800 outline-none focus:border-blue-500"
                  >
                    {attributes.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filter.op}
                    onChange={(event) => updateFilter(index, { op: event.target.value as CrmFilterOp })}
                    className="h-8 min-w-[140px] rounded-md border border-gray-200 bg-white px-2 text-[13px] text-gray-800 outline-none focus:border-blue-500"
                  >
                    {filterOperators.map((operator) => (
                      <option key={operator} value={operator}>
                        {operatorLabels[operator]}
                      </option>
                    ))}
                  </select>

                  {renderFilterValueInput(attribute, filter, (value) => updateFilter(index, { value }))}

                  <button
                    type="button"
                    onClick={() => removeFilter(index)}
                    className="ml-auto rounded-md p-1 text-gray-500 hover:bg-white hover:text-red-600"
                    aria-label="Remove filter"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })}

            {!filters.length ? (
              <div className="rounded-lg border border-dashed border-gray-200 px-3 py-8 text-center text-[13px] text-gray-500">
                Фильтры не настроены.
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={addFilter}
            className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 text-[13px] font-medium text-gray-700 hover:bg-gray-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Add filter
          </button>
        </div>
      ) : null}

      {openPanel === 'sorts' ? (
        <div className="absolute left-[112px] top-10 z-30 w-[560px] rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[13px] font-semibold text-gray-950">Sort</div>
            <button type="button" onClick={() => setOpenPanel(null)} className="rounded-md p-1 text-gray-500 hover:bg-gray-100">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-2">
            {sorts.map((sort, index) => (
              <div key={`${sort.attributeKey}-${index}`} className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 p-2">
                <select
                  value={sort.attributeKey}
                  onChange={(event) => updateSort(index, { attributeKey: event.target.value })}
                  className="h-8 min-w-[220px] rounded-md border border-gray-200 bg-white px-2 text-[13px] text-gray-800 outline-none focus:border-blue-500"
                >
                  {attributes.map((attribute) => (
                    <option key={attribute.key} value={attribute.key}>
                      {attribute.name}
                    </option>
                  ))}
                </select>

                <select
                  value={sort.dir}
                  onChange={(event) => updateSort(index, { dir: event.target.value as 'asc' | 'desc' })}
                  className="h-8 rounded-md border border-gray-200 bg-white px-2 text-[13px] text-gray-800 outline-none focus:border-blue-500"
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>

                <button
                  type="button"
                  onClick={() => removeSort(index)}
                  className="ml-auto rounded-md p-1 text-gray-500 hover:bg-white hover:text-red-600"
                  aria-label="Remove sort"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}

            {!sorts.length ? (
              <div className="rounded-lg border border-dashed border-gray-200 px-3 py-8 text-center text-[13px] text-gray-500">
                Сортировка не настроена.
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={addSort}
            className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 text-[13px] font-medium text-gray-700 hover:bg-gray-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Add sort
          </button>
        </div>
      ) : null}

      {openPanel === 'columns' ? (
        <div className="absolute left-[210px] top-10 z-30 w-[420px] rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <div className="text-[13px] font-semibold text-gray-950">Columns</div>
              <div className="text-[12px] text-gray-500">Выбор и порядок колонок текущего вида.</div>
            </div>
            <button type="button" onClick={() => setOpenPanel(null)} className="rounded-md p-1 text-gray-500 hover:bg-gray-100">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-1">
            {visibleColumns.map((column, index) => {
              const attribute = attributeByKey.get(column.attributeKey);

              return (
                <div key={column.attributeKey} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-gray-50">
                  <GripVertical className="h-3.5 w-3.5 text-gray-300" />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-gray-800">{attribute?.name ?? column.attributeName ?? column.attributeKey}</span>
                  <button
                    type="button"
                    onClick={() => moveColumn(column.attributeKey, -1)}
                    disabled={index === 0}
                    className="rounded px-1.5 py-0.5 text-[11px] text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    onClick={() => moveColumn(column.attributeKey, 1)}
                    disabled={index === visibleColumns.length - 1}
                    className="rounded px-1.5 py-0.5 text-[11px] text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    onClick={() => hideColumn(column.attributeKey)}
                    disabled={visibleColumns.length <= 1}
                    className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-red-600 disabled:opacity-30"
                    aria-label="Hide column"
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          {hiddenAttributes.length ? (
            <div className="mt-3 border-t border-gray-100 pt-3">
              <div className="mb-2 text-[12px] font-medium uppercase tracking-wide text-gray-500">+ колонка</div>
              <div className="flex flex-wrap gap-1.5">
                {hiddenAttributes.map((attribute) => (
                  <button
                    key={attribute.key}
                    type="button"
                    onClick={() => showColumn(attribute)}
                    className="inline-flex h-7 items-center gap-1 rounded-md border border-gray-200 bg-white px-2 text-[12px] text-gray-700 hover:bg-gray-50"
                  >
                    <Plus className="h-3 w-3" />
                    {attribute.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}