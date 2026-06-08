'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  ChevronDown,
  Download,
  Loader2,
  Plus,
  SlidersHorizontal,
  Table2,
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
  }, [columns, filters, object, objectKey, sorts]);

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
    <div className="flex h-full min-h-0 flex-col bg-white">
      <header className="shrink-0 border-b border-gray-200 bg-white">
        <div className="flex h-12 items-center justify-between px-4">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-blue-50 text-blue-700">
              <Table2 className="h-3.5 w-3.5" />
            </div>
            <h1 className="truncate text-[14px] font-semibold text-gray-950">{object.pluralName}</h1>
            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">
              {recordCount}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 text-[13px] font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              <Download className="h-3.5 w-3.5" />
              Import / Export
              <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
            </button>

            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 text-[13px] font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              View settings
              <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
            </button>

            <div className="inline-flex h-8 items-center rounded-md border border-gray-200 bg-gray-50 p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                aria-pressed={viewMode === 'table'}
                className={[
                  'inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-[13px] font-medium transition',
                  viewMode === 'table'
                    ? 'bg-white text-gray-950 shadow-sm'
                    : 'text-gray-600 hover:bg-white/70 hover:text-gray-900',
                ].join(' ')}
              >
                Table
              </button>

              <button
                type="button"
                onClick={() => setViewMode('board')}
                aria-pressed={viewMode === 'board'}
                className={[
                  'inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-[13px] font-medium transition',
                  viewMode === 'board'
                    ? 'bg-white text-gray-950 shadow-sm'
                    : 'text-gray-600 hover:bg-white/70 hover:text-gray-900',
                ].join(' ')}
              >
                Board
              </button>
            </div>

            <button
              type="button"
              onClick={handleCreateRecord}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-[13px] font-medium text-white shadow-sm hover:bg-blue-700"
            >
              <Plus className="h-3.5 w-3.5" />
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
            onRefresh={loadRecords}
          />
        )}
      </div>
    </div>
  );
}