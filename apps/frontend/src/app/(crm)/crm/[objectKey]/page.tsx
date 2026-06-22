'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  ChevronDown,
  Download,
  Loader2,
  Plus,
  Search,
  SlidersHorizontal,
  Table2,
  X,
} from 'lucide-react';
import BoardView from '@/components/crm/BoardView';
import DataTable from '@/components/crm/DataTable';
import ViewFilters from '@/components/crm/ViewFilters';
import {
  createView,
  deleteView,
  getObject,
  listRecords,
  listViews,
  updateView,
  type CrmObjectDetail,
  type CrmRecord,
  type CrmView,
  type CrmViewColumn,
  type CrmViewFilter,
  type CrmViewSort,
  type CrmViewType,
  type ListRecordsResponse,
} from '@/lib/crmApi';

type ViewMode = CrmViewType;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Не удалось загрузить данные CRM.';
}

function sortAttributes(object: CrmObjectDetail): CrmObjectDetail['attributes'] {
  return [...object.attributes].sort((first, second) => {
    const firstOrder = typeof first.order === 'number' ? first.order : 0;
    const secondOrder = typeof second.order === 'number' ? second.order : 0;
    return firstOrder - secondOrder;
  });
}

function buildDefaultColumns(object: CrmObjectDetail): CrmViewColumn[] {
  return sortAttributes(object).map((attribute, index) => ({
    attributeKey: attribute.key,
    attributeName: attribute.name,
    attributeType: attribute.type,
    order: index,
    isVisible: true,
  }));
}

function normalizeColumns(view: CrmView | null, object: CrmObjectDetail): CrmViewColumn[] {
  if (!view?.columns?.length) {
    return buildDefaultColumns(object);
  }

  const attributeKeys = new Set(object.attributes.map((attribute) => attribute.key));
  const columns = view.columns
    .filter((column) => column.attributeKey && attributeKeys.has(column.attributeKey) && column.isVisible !== false)
    .sort((first, second) => (first.order ?? 0) - (second.order ?? 0))
    .map((column, index) => ({
      ...column,
      order: index,
      isVisible: true,
    }));

  return columns.length ? columns : buildDefaultColumns(object);
}

function normalizeFilters(view: CrmView | null): CrmViewFilter[] {
  return (view?.filters ?? [])
    .filter((filter) => Boolean(filter.attributeKey))
    .sort((first, second) => (first.order ?? 0) - (second.order ?? 0))
    .map((filter, index) => ({
      attributeKey: filter.attributeKey,
      attributeName: filter.attributeName,
      op: filter.op,
      value: filter.value,
      order: index,
    }));
}

function normalizeSorts(view: CrmView | null): CrmViewSort[] {
  return (view?.sorts ?? [])
    .filter((sort) => Boolean(sort.attributeKey))
    .sort((first, second) => (first.order ?? 0) - (second.order ?? 0))
    .map((sort, index) => ({
      attributeKey: sort.attributeKey,
      attributeName: sort.attributeName,
      dir: sort.dir,
      order: index,
    }));
}

function pickInitialView(views: CrmView[]): CrmView | null {
  return views.find((view) => view.isDefault) ?? views[0] ?? null;
}

export default function CrmObjectPage() {
  const params = useParams<{ objectKey?: string | string[] }>();
  const objectKey = useMemo(() => {
    const raw = params.objectKey;
    return Array.isArray(raw) ? raw[0] : raw ?? '';
  }, [params.objectKey]);

  const [object, setObject] = useState<CrmObjectDetail | null>(null);
  const [views, setViews] = useState<CrmView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [filters, setFilters] = useState<CrmViewFilter[]>([]);
  const [sorts, setSorts] = useState<CrmViewSort[]>([]);
  const [columns, setColumns] = useState<CrmViewColumn[]>([]);
  const [records, setRecords] = useState<CrmRecord[]>([]);
  const [pagination, setPagination] = useState<ListRecordsResponse['pagination'] | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRecordsLoading, setIsRecordsLoading] = useState(false);
  const [isSavingView, setIsSavingView] = useState(false);
  const [createSignal, setCreateSignal] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [error, setError] = useState<string | null>(null);
  // Строка поиска (S064)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeView = useMemo(
    () => views.find((view) => view.id === activeViewId) ?? null,
    [activeViewId, views],
  );

  const loadPageConfig = useCallback(async () => {
    if (!objectKey) return;

    setIsInitialLoading(true);
    setError(null);

    try {
      const [objectData, viewsData] = await Promise.all([
        getObject(objectKey),
        listViews(objectKey),
      ]);
      const initialView = pickInitialView(viewsData);

      setObject(objectData);
      setViews(viewsData);
      setActiveViewId(initialView?.id ?? null);
      setFilters(normalizeFilters(initialView));
      setSorts(normalizeSorts(initialView));
      setColumns(normalizeColumns(initialView, objectData));
      setViewMode(initialView?.type ?? 'table');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsInitialLoading(false);
    }
  }, [objectKey]);

  const loadRecords = useCallback(async () => {
    if (!objectKey || !object) return;

    setIsRecordsLoading(true);
    setError(null);

    try {
      const recordsData = await listRecords({
        objectKey,
        page: 1,
        limit: 50,
        search: searchQuery || undefined,
        filters,
        sorts,
        columns,
      });

      setRecords(recordsData.records);
      setPagination(recordsData.pagination);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsRecordsLoading(false);
    }
  }, [columns, filters, object, objectKey, searchQuery, sorts]);

  useEffect(() => {
    loadPageConfig();
  }, [loadPageConfig]);

  useEffect(() => {
    if (object && !isInitialLoading) {
      loadRecords();
    }
  }, [isInitialLoading, loadRecords, object]);

  const handleCreateRecord = useCallback(() => {
    setViewMode('table');
    setCreateSignal((value) => value + 1);
  }, []);

  // Обработчик поля поиска с debounce (S064)
  function handleSearchInputChange(value: string) {
    setSearchInput(value);

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(() => {
      setSearchQuery(value);
    }, 300);
  }

  function applyView(view: CrmView, currentObject = object) {
    if (!currentObject) return;

    setActiveViewId(view.id);
    setFilters(normalizeFilters(view));
    setSorts(normalizeSorts(view));
    setColumns(normalizeColumns(view, currentObject));
    setViewMode(view.type ?? 'table');
  }

  function handleSelectView(viewId: string) {
    const view = views.find((item) => item.id === viewId);
    if (!view) return;

    applyView(view);
  }

  async function refreshViewsAndSelect(viewId: string) {
    if (!objectKey || !object) return;

    const nextViews = await listViews(objectKey);
    const selectedView = nextViews.find((view) => view.id === viewId) ?? pickInitialView(nextViews);

    setViews(nextViews);

    if (selectedView) {
      applyView(selectedView);
    } else {
      setActiveViewId(null);
      setFilters([]);
      setSorts([]);
      setColumns(buildDefaultColumns(object));
      setViewMode('table');
    }
  }

  async function handleSaveView() {
    if (!activeViewId || !objectKey) return;

    setIsSavingView(true);
    setError(null);

    try {
      const savedView = await updateView(activeViewId, {
        type: viewMode,
        filters,
        sorts,
        columns,
      });

      await refreshViewsAndSelect(savedView.id);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSavingView(false);
    }
  }

  async function handleSaveAsNew() {
    if (!objectKey || !object) return;

    const name = window.prompt('Название нового вида', activeView ? `${activeView.name} copy` : `Custom ${object.pluralName}`);

    if (!name?.trim()) return;

    setIsSavingView(true);
    setError(null);

    try {
      const savedView = await createView({
        objectKey,
        name: name.trim(),
        type: viewMode,
        filters,
        sorts,
        columns,
      });

      await refreshViewsAndSelect(savedView.id);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSavingView(false);
    }
  }

  async function handleDeleteView() {
    if (!activeViewId) return;

    const confirmed = window.confirm('Удалить текущий сохранённый вид?');
    if (!confirmed) return;

    setIsSavingView(true);
    setError(null);

    try {
      await deleteView(activeViewId);
      await refreshViewsAndSelect('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSavingView(false);
    }
  }

  const recordCount = pagination?.total ?? records.length;
  const isLoading = isInitialLoading || isRecordsLoading;

  if (isInitialLoading && !object) {
    return (
      <div className="flex h-full items-center justify-center bg-white text-[13px] text-gray-600">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Загрузка объекта…
      </div>
    );
  }

  if (error && !object) {
    return (
      <div className="flex h-full items-center justify-center bg-white px-6">
        <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-[15px] font-semibold text-gray-950">Объект не загрузился</h1>
          <p className="mt-2 text-[13px] leading-5 text-gray-600">{error}</p>
          <button
            type="button"
            onClick={loadPageConfig}
            className="mt-4 rounded-md bg-blue-600 px-3 py-2 text-[13px] font-medium text-white hover:bg-blue-700"
          >
            Повторить
          </button>
        </div>
      </div>
    );
  }

  if (!object) {
    return null;
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <header className="shrink-0 border-b border-line bg-surface/80 backdrop-blur">
        <div className="flex h-16 items-center justify-between px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="brand-gradient flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-brand ring-1 ring-white/40">
              <Table2 className="h-[18px] w-[18px]" />
            </div>
            <h1 className="truncate text-xl font-bold tracking-[-0.02em] text-ink">{object.pluralName}</h1>
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[12px] font-semibold text-brand-700 ring-1 ring-inset ring-brand-100">
              {recordCount}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Поиск по записям (S064) */}
            <div className="relative flex items-center">
              <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-ink-subtle" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => handleSearchInputChange(e.target.value)}
                placeholder="Search..."
                className="h-9 w-48 rounded-lg border border-line bg-surface pl-9 pr-7 text-[13px] text-ink outline-none placeholder:text-ink-subtle focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:w-64 transition-all"
              />
              {searchInput ? (
                <button
                  type="button"
                  onClick={() => handleSearchInputChange('')}
                  className="absolute right-2.5 text-ink-subtle hover:text-ink"
                  aria-label="Очистить"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[13px] font-medium text-ink-muted shadow-xs transition-all hover:bg-surface-2 hover:text-ink hover:border-line-strong"
            >
              <Download className="h-3.5 w-3.5" />
              Import / Export
              <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" />
            </button>

            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[13px] font-medium text-ink-muted shadow-xs transition-all hover:bg-surface-2 hover:text-ink hover:border-line-strong"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              View settings
              <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" />
            </button>

            <div className="inline-flex h-9 items-center rounded-lg border border-line bg-surface-2 p-0.5 shadow-xs">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                aria-pressed={viewMode === 'table'}
                className={[
                  'inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-[13px] font-semibold transition-all',
                  viewMode === 'table'
                    ? 'bg-brand-50 text-brand-700 shadow-xs ring-1 ring-brand-100'
                    : 'text-ink-muted hover:text-ink',
                ].join(' ')}
              >
                Table
              </button>

              <button
                type="button"
                onClick={() => setViewMode('board')}
                aria-pressed={viewMode === 'board'}
                className={[
                  'inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-[13px] font-semibold transition-all',
                  viewMode === 'board'
                    ? 'bg-brand-50 text-brand-700 shadow-xs ring-1 ring-brand-100'
                    : 'text-ink-muted hover:text-ink',
                ].join(' ')}
              >
                Board
              </button>
            </div>

            <button
              type="button"
              onClick={handleCreateRecord}
              className="brand-gradient inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-[13px] font-semibold text-white shadow-brand transition-all hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
            >
              <Plus className="h-4 w-4" />
              New {object.singularName}
            </button>
          </div>
        </div>

        <ViewFilters
          object={object}
          views={views}
          activeViewId={activeViewId}
          viewMode={viewMode}
          filters={filters}
          sorts={sorts}
          columns={columns}
          isSaving={isSavingView}
          onSelectView={handleSelectView}
          onFiltersChange={setFilters}
          onSortsChange={setSorts}
          onColumnsChange={setColumns}
          onSaveView={handleSaveView}
          onSaveAsNew={handleSaveAsNew}
          onDeleteView={handleDeleteView}
        />
      </header>

      {error ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-[13px] text-amber-800">
          {error}
        </div>
      ) : null}

      <div className="min-h-0 flex-1">
        {viewMode === 'board' ? (
          <BoardView
            object={object}
            records={records}
            onRecordsChange={setRecords}
            onCreateRecord={handleCreateRecord}
          />
        ) : (
          <DataTable
            object={object}
            records={records}
            pagination={pagination}
            isLoading={isLoading}
            newRecordSignal={createSignal}
            columns={columns}
            searchQuery={searchInput}
            onSearchChange={handleSearchInputChange}
            onRefresh={loadRecords}
          />
        )}
      </div>
    </div>
  );
}