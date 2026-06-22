import axios, { AxiosError } from 'axios';
import { getToken, logout } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const crmApi = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

crmApi.interceptors.request.use((config) => {
  const token = getToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

crmApi.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      logout();
    }

    return Promise.reject(err);
  },
);

export type CrmAttributeType =
  | 'TEXT'
  | 'LONG_TEXT'
  | 'NUMBER'
  | 'CURRENCY'
  | 'DATE'
  | 'DATETIME'
  | 'BOOLEAN'
  | 'SELECT'
  | 'MULTI_SELECT'
  | 'RELATIONSHIP'
  | 'URL'
  | 'EMAIL'
  | 'PHONE'
  | 'USER'
  | 'JSON'
  | 'LOCATION';

export type CrmRecordValue =
  | string
  | number
  | boolean
  | null
  | string[]
  | number[]
  | Record<string, unknown>
  | Array<Record<string, unknown>>;

export type CrmViewType = 'table' | 'board';
export type CrmFilterOp = 'eq' | 'neq' | 'contains' | 'gt' | 'lt' | 'in' | 'is_empty' | 'is_not_empty';
export type CrmSortDir = 'asc' | 'desc';

export interface CrmStatus {
  hasObjects: boolean;
  totalObjects: number;
  standardObjects: {
    companies?: boolean;
    people?: boolean;
    deals?: boolean;
    [key: string]: boolean | undefined;
  };
  counts?: Record<string, number>;
}

export interface CrmAttributeOption {
  id?: string;
  key: string;
  value?: string;
  label?: string;
  name?: string;
  color?: string | null;
  order?: number;
}

export type CrmAttributeConfig = Record<string, unknown> & {
  options?: CrmAttributeOption[];
  choices?: CrmAttributeOption[];
  targetObjectKey?: string;
  targetObjectId?: string;
  relationObjectKey?: string;
};

export interface CrmAttribute {
  id: string;
  key: string;
  name: string;
  type: CrmAttributeType;
  order: number;
  isPrimary: boolean;
  config?: CrmAttributeConfig | null;
  options?: CrmAttributeOption[];
  // AI-атрибут (M2): агент заполняет значение.
  aiEnabled?: boolean;
  aiType?: 'CLASSIFY' | 'SUMMARIZE' | 'RESEARCH' | 'PROMPT' | null;
  aiPrompt?: string | null;
  aiGuidance?: string | null;
  aiConfig?: Record<string, unknown> | null;
}

export interface CrmViewFilter {
  id?: string;
  attributeKey: string;
  attributeName?: string | null;
  op: CrmFilterOp;
  value?: unknown;
  group?: number;
  order?: number;
}

// M24-1: AND/OR дерево фильтра (лист | группа). Совпадает с backend filterTree.
export type CrmFilterLeaf = { attributeKey: string; op: CrmFilterOp; value?: unknown };
export type CrmFilterGroup = { op: 'AND' | 'OR'; children: CrmFilterNode[] };
export type CrmFilterNode = CrmFilterLeaf | CrmFilterGroup;
export type CrmViewScope = 'personal' | 'shared';

export function isFilterGroup(node: CrmFilterNode): node is CrmFilterGroup {
  return (node as CrmFilterGroup).children !== undefined;
}

// M24-3: per-column calculations (S092)
export type CrmCalcType = 'count' | 'sum' | 'avg' | 'min' | 'max' | 'empty';
export type CrmCalcRequest = { attributeKey: string; type: CrmCalcType };
export interface CrmCalcResult {
  attributeKey: string;
  type: CrmCalcType;
  value: number | string | null;
  count: number;
  emptyCount?: number;
  currencyCode?: string;
  mixedCurrency?: boolean;
  skippedReason?: string;
}

export interface CrmViewSort {
  id?: string;
  attributeKey: string;
  attributeName?: string | null;
  dir: CrmSortDir;
  order?: number;
}

export interface CrmViewColumn {
  id?: string;
  attributeKey: string;
  attributeName?: string | null;
  attributeType?: CrmAttributeType;
  order?: number;
  width?: number | null;
  isVisible?: boolean;
  config?: Record<string, unknown> | null;
}

export interface CrmView {
  id: string;
  source?: 'object' | 'list';
  objectKey?: string | null;
  listId?: string | null;
  name: string;
  key?: string | null;
  type: CrmViewType;
  scope?: CrmViewScope;
  isDefault?: boolean;
  isOwner?: boolean;
  order?: number;
  groupByAttributeKey?: string | null;
  config?: Record<string, unknown> | null;
  filters?: CrmViewFilter[];
  filterTree?: CrmFilterNode | null;
  filterWarnings?: string[];
  sorts?: CrmViewSort[];
  columns?: CrmViewColumn[];
  createdById?: string | null;
}

export interface CrmObject {
  id: string;
  key: string;
  singularName: string;
  pluralName: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  isSystem: boolean;
  _count?: {
    attributes?: number;
    records?: number;
    views?: number;
    lists?: number;
  };
}

export interface CrmObjectDetail extends CrmObject {
  attributes: CrmAttribute[];
  views: CrmView[];
}

export interface CrmAttributeFull extends CrmAttribute {
  description?: string | null;
  isRequired?: boolean;
  isUnique?: boolean;
  isSystem?: boolean;
  isArchived?: boolean;
  objectId?: string;
  orgId?: string;
}

export interface CreateObjectPayload {
  key: string;
  singularName: string;
  pluralName: string;
  description?: string;
  icon?: string;
  color?: string;
}

export interface UpdateObjectPayload {
  singularName?: string;
  pluralName?: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  primaryAttributeId?: string;
}

/** AI-поля атрибута (M2): общие для create/update. */
export interface AiAttributeFields {
  aiEnabled?: boolean;
  aiType?: 'CLASSIFY' | 'SUMMARIZE' | 'RESEARCH' | 'PROMPT' | null;
  aiPrompt?: string | null;
  aiGuidance?: string | null;
  aiConfig?: Record<string, unknown> | null;
}

export interface CreateAttributePayload extends AiAttributeFields {
  key: string;
  name: string;
  description?: string;
  type: CrmAttributeType;
  isRequired?: boolean;
  isUnique?: boolean;
  isPrimary?: boolean;
  order?: number;
  config?: Record<string, unknown>;
  options?: Array<{ value: string; label: string; color?: string; order?: number }>;
  relationship?: {
    targetObjectId?: string;
    targetObjectKey?: string;
    cardinality?: 'ONE_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_ONE' | 'MANY_TO_MANY';
    isBidirectional?: boolean;
  };
}

export interface UpdateAttributePayload extends AiAttributeFields {
  name?: string;
  description?: string | null;
  isRequired?: boolean;
  isUnique?: boolean;
  isPrimary?: boolean;
  order?: number;
  config?: Record<string, unknown> | null;
}

export interface CreateOptionPayload {
  value: string;
  label: string;
  color?: string;
  order?: number;
}

export interface UpdateOptionPayload {
  value?: string;
  label?: string;
  color?: string | null;
  order?: number;
}

export type ValueSourceKind = 'MANUAL' | 'AI' | 'IMPORT' | 'SYSTEM';

export interface CrmRecord {
  id: string;
  objectKey: string;
  displayName: string;
  values: Record<string, CrmRecordValue>;
  // M29-1: происхождение текущего значения по атрибуту (значок AI/Manual, защита от перезаписи).
  valueMeta?: Record<string, { source: ValueSourceKind; lastAiRunId: string | null }>;
  createdAt?: string;
  updatedAt?: string;
}

export interface RecordsPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ListRecordsParams {
  objectKey: string;
  page?: number;
  limit?: number;
  search?: string;
  filters?: CrmViewFilter[];
  filterTree?: CrmFilterNode | null;
  sorts?: CrmViewSort[];
  columns?: CrmViewColumn[];
  calcs?: CrmCalcRequest[];
}

export interface ListRecordsResponse {
  records: CrmRecord[];
  calculations?: CrmCalcResult[];
  pagination: RecordsPagination;
}

export interface CreateViewPayload {
  objectKey?: string;
  listId?: string;
  name: string;
  type: CrmViewType;
  scope?: CrmViewScope;
  filters?: CrmViewFilter[];
  filterTree?: CrmFilterNode | null;
  sorts?: CrmViewSort[];
  columns?: CrmViewColumn[];
  groupByAttributeKey?: string | null;
  config?: Record<string, unknown>;
}

export interface UpdateViewPayload {
  name?: string;
  type?: CrmViewType;
  scope?: CrmViewScope;
  filters?: CrmViewFilter[];
  filterTree?: CrmFilterNode | null;
  sorts?: CrmViewSort[];
  columns?: CrmViewColumn[];
  groupByAttributeKey?: string | null;
  config?: Record<string, unknown>;
}

type CreateRecordResponse = CrmRecord | { record: CrmRecord };
type UpdateRecordResponse = CrmRecord | { record: CrmRecord };

function encodeJsonParam<T>(value?: T[]): string | undefined {
  return value && value.length ? JSON.stringify(value) : undefined;
}

export async function getCrmStatus(): Promise<CrmStatus> {
  const { data } = await crmApi.get<CrmStatus>('/crm/status');
  return data;
}

export async function bootstrapCrm(): Promise<CrmStatus> {
  const { data } = await crmApi.post<CrmStatus>('/crm/bootstrap');
  return data;
}

export async function listObjects(): Promise<CrmObject[]> {
  const { data } = await crmApi.get<{ objects: CrmObject[] }>('/objects');
  return data.objects;
}

export async function getObject(key: string): Promise<CrmObjectDetail> {
  const { data } = await crmApi.get<CrmObjectDetail>(`/objects/${encodeURIComponent(key)}`);
  return data;
}

export async function createObject(payload: CreateObjectPayload): Promise<CrmObjectDetail> {
  const { data } = await crmApi.post<CrmObjectDetail>('/objects', payload);
  return data;
}

export async function updateObject(id: string, payload: UpdateObjectPayload): Promise<CrmObject> {
  const { data } = await crmApi.patch<CrmObject>(`/objects/${encodeURIComponent(id)}`, payload);
  return data;
}

export async function archiveObject(id: string): Promise<void> {
  await crmApi.delete(`/objects/${encodeURIComponent(id)}`);
}

export async function createAttribute(
  objectId: string,
  payload: CreateAttributePayload,
): Promise<CrmAttributeFull> {
  const { data } = await crmApi.post<CrmAttributeFull>(
    `/objects/${encodeURIComponent(objectId)}/attributes`,
    payload,
  );
  return data;
}

export async function updateAttribute(
  objectId: string,
  attributeId: string,
  payload: UpdateAttributePayload,
): Promise<CrmAttributeFull> {
  const { data } = await crmApi.patch<CrmAttributeFull>(
    `/objects/${encodeURIComponent(objectId)}/attributes/${encodeURIComponent(attributeId)}`,
    payload,
  );
  return data;
}

export async function archiveAttribute(objectId: string, attributeId: string): Promise<void> {
  await crmApi.delete(
    `/objects/${encodeURIComponent(objectId)}/attributes/${encodeURIComponent(attributeId)}`,
  );
}

export async function createAttributeOption(
  objectId: string,
  attributeId: string,
  payload: CreateOptionPayload,
): Promise<CrmAttributeOption> {
  const { data } = await crmApi.post<CrmAttributeOption>(
    `/objects/${encodeURIComponent(objectId)}/attributes/${encodeURIComponent(attributeId)}/options`,
    payload,
  );
  return data;
}

export async function updateAttributeOption(
  objectId: string,
  attributeId: string,
  optionId: string,
  payload: UpdateOptionPayload,
): Promise<CrmAttributeOption> {
  const { data } = await crmApi.patch<CrmAttributeOption>(
    `/objects/${encodeURIComponent(objectId)}/attributes/${encodeURIComponent(attributeId)}/options/${encodeURIComponent(optionId)}`,
    payload,
  );
  return data;
}

export async function archiveAttributeOption(
  objectId: string,
  attributeId: string,
  optionId: string,
): Promise<void> {
  await crmApi.delete(
    `/objects/${encodeURIComponent(objectId)}/attributes/${encodeURIComponent(attributeId)}/options/${encodeURIComponent(optionId)}`,
  );
}

export async function archiveRecord(id: string): Promise<void> {
  await crmApi.delete(`/records/${encodeURIComponent(id)}`);
}

export async function listRecords(params: ListRecordsParams): Promise<ListRecordsResponse> {
  const { objectKey, page = 1, limit = 50, search = '', filters = [], filterTree, sorts = [], columns = [], calcs = [] } = params;

  const { data } = await crmApi.get<ListRecordsResponse>('/records', {
    params: {
      objectKey,
      page,
      limit,
      search,
      // M24-1: filterTree приоритетнее плоского filters[]; backend оценивает через recordFilter.ts.
      filterTree: filterTree ? JSON.stringify(filterTree) : undefined,
      filters: filterTree ? undefined : encodeJsonParam(filters),
      sorts: encodeJsonParam(sorts),
      columns: encodeJsonParam(columns),
      // M24-3: per-column calculations по filtered-set.
      calcs: calcs.length ? JSON.stringify(calcs) : undefined,
    },
  });

  return data;
}

// M24-1/M24-3: записи списка + view (filterTree + sorts + calcs) — паритет с object table-view.
export async function listListRecords(
  listId: string,
  params: { page?: number; limit?: number; filterTree?: CrmFilterNode | null; sorts?: CrmViewSort[]; calcs?: CrmCalcRequest[] } = {},
): Promise<ListRecordsResponse & { records: (CrmRecord & { entryId?: string | null; stage?: string | null })[]; restrictedSource?: boolean; hiddenCount?: number; warnings?: string[] }> {
  const { page = 1, limit = 100, filterTree, sorts = [], calcs = [] } = params;
  const { data } = await crmApi.get<ListRecordsResponse & { restrictedSource?: boolean; hiddenCount?: number; warnings?: string[] }>(`/lists/${encodeURIComponent(listId)}/records`, {
    params: {
      page,
      limit,
      filterTree: filterTree ? JSON.stringify(filterTree) : undefined,
      sorts: sorts.length ? JSON.stringify(sorts) : undefined,
      calcs: calcs.length ? JSON.stringify(calcs) : undefined,
    },
  });
  return data;
}

export async function getRecord(id: string): Promise<CrmRecord> {
  const { data } = await crmApi.get<CrmRecord>(`/records/${encodeURIComponent(id)}`);
  return data;
}

export async function createRecord(
  objectKey: string,
  values: Record<string, CrmRecordValue>,
): Promise<CrmRecord> {
  const { data } = await crmApi.post<CreateRecordResponse>('/records', {
    objectKey,
    values,
  });

  if ('record' in data) {
    return data.record;
  }

  return data;
}

export async function updateRecord(
  id: string,
  values: Record<string, CrmRecordValue>,
): Promise<CrmRecord> {
  const { data } = await crmApi.patch<UpdateRecordResponse>(`/records/${encodeURIComponent(id)}`, {
    values,
  });

  if ('record' in data) {
    return data.record;
  }

  return data;
}

// Переместить запись по SELECT/USER-атрибуту (board drag-drop). value=null → «No stage» (очистка).
// Backend проверяет RBAC (MEMBER → 403), required-атрибут нельзя очистить (422), пишет Activity.
export async function moveRecord(id: string, attributeKey: string, value: string | null): Promise<CrmRecord> {
  const { data } = await crmApi.patch<CrmRecord>(`/records/${encodeURIComponent(id)}/move`, { attributeKey, value });
  return data;
}

export async function listViews(source: string | { objectKey?: string; listId?: string }): Promise<CrmView[]> {
  const params = typeof source === 'string' ? { objectKey: source } : source;
  const { data } = await crmApi.get<{ views: CrmView[] }>('/views', { params });

  return data.views;
}

export async function createView(payload: CreateViewPayload): Promise<CrmView> {
  const { data } = await crmApi.post<CrmView>('/views', payload);
  return data;
}

export async function getView(id: string): Promise<CrmView> {
  const { data } = await crmApi.get<CrmView>(`/views/${encodeURIComponent(id)}`);
  return data;
}

export async function updateView(id: string, payload: UpdateViewPayload): Promise<CrmView> {
  const { data } = await crmApi.patch<CrmView>(`/views/${encodeURIComponent(id)}`, payload);
  return data;
}

export async function deleteView(id: string): Promise<CrmView> {
  const { data } = await crmApi.delete<CrmView>(`/views/${encodeURIComponent(id)}`);
  return data;
}

// ── Активности записи (S061) ─────────────────────────────────────────────────

export interface CrmActivity {
  id: string;
  type: string;
  title?: string | null;
  body?: string | null;
  // M27-1: payload наружу больше не отдаётся; redacted=true → нет доступа к связанной сущности (title/body скрыты).
  createdAt: string;
  actor?: { id: string; name: string | null; email: string } | null;
  redacted?: boolean;
}

export interface ListActivitiesResponse {
  activities: CrmActivity[];
  pagination: RecordsPagination;
}

export async function getRecordActivities(
  recordId: string,
  page = 1,
  limit = 50,
): Promise<ListActivitiesResponse> {
  const { data } = await crmApi.get<ListActivitiesResponse>(
    `/records/${encodeURIComponent(recordId)}/activities`,
    { params: { page, limit } },
  );
  return data;
}

// ── M27-2: Notes / Tasks на записи ────────────────────────────────────────────
export interface CrmPerson { id: string; name: string | null; email: string }
export interface CrmNote {
  id: string;
  body: string | null;
  placeholder?: string;
  deleted: boolean;
  edited: boolean;
  author?: CrmPerson | null;
  createdAt: string;
  updatedAt: string;
}
export type CrmTaskStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';
export type CrmTaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export interface CrmTask {
  id: string;
  title: string;
  description?: string | null;
  status: CrmTaskStatus;
  priority: CrmTaskPriority;
  dueAt?: string | null;
  completedAt?: string | null;
  assignee?: CrmPerson | null;
  createdBy?: CrmPerson | null;
  createdAt: string;
  updatedAt: string;
}

export async function listNotes(recordId: string): Promise<CrmNote[]> {
  const { data } = await crmApi.get<{ notes: CrmNote[] }>(`/records/${encodeURIComponent(recordId)}/notes`);
  return data.notes;
}
export async function createNote(recordId: string, body: string): Promise<CrmNote> {
  const { data } = await crmApi.post<CrmNote>(`/records/${encodeURIComponent(recordId)}/notes`, { body });
  return data;
}
export async function updateNote(recordId: string, noteId: string, body: string): Promise<CrmNote> {
  const { data } = await crmApi.patch<CrmNote>(`/records/${encodeURIComponent(recordId)}/notes/${encodeURIComponent(noteId)}`, { body });
  return data;
}
export async function deleteNote(recordId: string, noteId: string): Promise<void> {
  await crmApi.delete(`/records/${encodeURIComponent(recordId)}/notes/${encodeURIComponent(noteId)}`);
}

export async function listTasks(recordId: string): Promise<CrmTask[]> {
  const { data } = await crmApi.get<{ tasks: CrmTask[] }>(`/records/${encodeURIComponent(recordId)}/tasks`);
  return data.tasks;
}
export interface CreateTaskPayload { title: string; description?: string | null; priority?: CrmTaskPriority; dueAt?: string | null; assigneeId?: string | null }
export async function createTask(recordId: string, payload: CreateTaskPayload): Promise<CrmTask> {
  const { data } = await crmApi.post<CrmTask>(`/records/${encodeURIComponent(recordId)}/tasks`, payload);
  return data;
}
export type UpdateTaskPayload = Partial<CreateTaskPayload> & { status?: CrmTaskStatus };
export async function updateTask(recordId: string, taskId: string, payload: UpdateTaskPayload): Promise<CrmTask> {
  const { data } = await crmApi.patch<CrmTask>(`/records/${encodeURIComponent(recordId)}/tasks/${encodeURIComponent(taskId)}`, payload);
  return data;
}
export async function deleteTask(recordId: string, taskId: string): Promise<void> {
  await crmApi.delete(`/records/${encodeURIComponent(recordId)}/tasks/${encodeURIComponent(taskId)}`);
}

// ── M27-3: Calls / Emails на записи (real surfaces) ───────────────────────────
export interface CrmRecordCall {
  id: string;
  direction: string;
  status: string;
  outcome?: string | null;
  durationSec: number;
  summary?: string | null;
  aiIntent?: string | null;
  nextStep?: string | null;
  createdAt: string;
  associationType: string;
}
export interface CrmRecordEmail {
  id: string;
  direction: string;
  status: string;
  subject?: string | null;
  fromEmail?: string | null;
  toEmails?: unknown;
  aiGenerated: boolean;
  demo: boolean;
  sentAt?: string | null;
  createdAt: string;
  snippet: string;
}
export async function listRecordCalls(recordId: string): Promise<CrmRecordCall[]> {
  const { data } = await crmApi.get<{ calls: CrmRecordCall[] }>(`/records/${encodeURIComponent(recordId)}/calls`);
  return data.calls;
}
export async function unlinkRecordCall(recordId: string, callId: string): Promise<void> {
  await crmApi.delete(`/records/${encodeURIComponent(recordId)}/calls/${encodeURIComponent(callId)}`);
}
export async function listRecordEmails(recordId: string): Promise<CrmRecordEmail[]> {
  const { data } = await crmApi.get<{ emails: CrmRecordEmail[] }>(`/records/${encodeURIComponent(recordId)}/emails`);
  return data.emails;
}

// ── M28-1/2: Compose email (recipients / variables / templates / preview / draft·send) ───────────

export interface EmailRecipientCandidate {
  recordId: string;
  objectKey: string | null;
  objectName: string | null;
  displayName: string | null;
  email: string;
  source: 'self' | 'related';
  relationLabel: string | null;
}
export interface EmailMergeVariable {
  token: string;
  label: string;
  group: 'record' | 'recipient';
  sample: string | null;
}
export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  createdBy?: { id: string; name: string | null; email: string } | null;
  createdById: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface EmailComposePreview {
  to: string | null;
  recipientName: string | null;
  recipientResolved: boolean;
  subject: string;
  body: string;
  unresolved: string[];
  empty: string[];
  demo: boolean;
  disclaimer: string;
  recordArchived: boolean;
  canSend: boolean;
}
export interface ComposeRecipientInput { email?: string | null; name?: string | null; recordId?: string | null }
export interface ComposedEmail {
  id: string;
  direction: string;
  status: string;
  subject: string | null;
  fromEmail: string | null;
  toEmails: unknown;
  aiGenerated: boolean;
  demo: boolean;
  templateId: string | null;
  sentAt: string | null;
  createdAt: string;
  snippet: string;
}

export async function listEmailRecipients(recordId: string): Promise<EmailRecipientCandidate[]> {
  const { data } = await crmApi.get<{ recipients: EmailRecipientCandidate[] }>(`/records/${encodeURIComponent(recordId)}/email-recipients`);
  return data.recipients;
}
export async function listEmailVariables(recordId: string): Promise<EmailMergeVariable[]> {
  const { data } = await crmApi.get<{ variables: EmailMergeVariable[] }>(`/records/${encodeURIComponent(recordId)}/email-variables`);
  return data.variables;
}
export async function listEmailTemplates(): Promise<{ templates: EmailTemplate[]; canManage: boolean }> {
  const { data } = await crmApi.get<{ templates: EmailTemplate[]; canManage: boolean }>(`/email-templates`);
  return data;
}
export async function previewComposeEmail(recordId: string, input: { subject: string; body: string; templateId?: string | null; recipient: ComposeRecipientInput }): Promise<EmailComposePreview> {
  const { data } = await crmApi.post<EmailComposePreview>(`/records/${encodeURIComponent(recordId)}/emails/preview`, input);
  return data;
}
export async function composeEmail(recordId: string, input: { action: 'draft' | 'send'; subject: string; body: string; templateId?: string | null; recipient: ComposeRecipientInput; idempotencyKey?: string | null }): Promise<{ email: ComposedEmail; demo: boolean; disclaimer: string; idempotent?: boolean; empty?: string[] }> {
  const { data } = await crmApi.post<{ email: ComposedEmail; demo: boolean; disclaimer: string; idempotent?: boolean; empty?: string[] }>(`/records/${encodeURIComponent(recordId)}/emails`, input);
  return data;
}

// ── M28-3: Global emails list + safe detail + hidden-count ───────────────────────────────────────

export interface GlobalEmailLinkedRecord { id: string; displayName: string | null; objectKey: string | null; objectName: string | null }
export interface GlobalEmail {
  id: string;
  direction: string;
  status: string;
  subject: string | null;
  fromEmail: string | null;
  fromName: string | null;
  toEmails: unknown;
  aiGenerated: boolean;
  demo: boolean;
  sentAt: string | null;
  createdAt: string;
  snippet: string;
  linkedRecord: GlobalEmailLinkedRecord | null;
}
export interface GlobalEmailDetail extends GlobalEmail {
  bodyText: string | null;
  ccEmails?: unknown;
  templateId: string | null;
  openedAt: string | null;
  repliedAt: string | null;
}
export interface GlobalEmailsPage {
  emails: GlobalEmail[];
  total: number;
  hiddenCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
export async function listGlobalEmails(params: { page?: number; pageSize?: number; status?: string; direction?: string; recordId?: string } = {}): Promise<GlobalEmailsPage> {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  if (params.status) qs.set('status', params.status);
  if (params.direction) qs.set('direction', params.direction);
  if (params.recordId) qs.set('recordId', params.recordId);
  const { data } = await crmApi.get<GlobalEmailsPage>(`/emails${qs.toString() ? `?${qs.toString()}` : ''}`);
  return data;
}
export async function getGlobalEmail(id: string): Promise<GlobalEmailDetail> {
  const { data } = await crmApi.get<{ email: GlobalEmailDetail }>(`/emails/${encodeURIComponent(id)}`);
  return data.email;
}

// ── M28-5: Outbox / drafts / demo-resend ─────────────────────────────────────────────────────────
export async function editDraftEmail(id: string, input: { subject?: string; body?: string }): Promise<GlobalEmailDetail> {
  const { data } = await crmApi.patch<{ email: GlobalEmailDetail }>(`/emails/${encodeURIComponent(id)}`, input);
  return data.email;
}
export async function sendDraftEmail(id: string): Promise<{ email: GlobalEmailDetail; idempotent?: boolean }> {
  const { data } = await crmApi.post<{ email: GlobalEmailDetail; idempotent?: boolean }>(`/emails/${encodeURIComponent(id)}/send`);
  return data;
}
export async function resendEmail(id: string, idempotencyKey?: string): Promise<{ email: GlobalEmailDetail; resent?: boolean; idempotent?: boolean }> {
  const { data } = await crmApi.post<{ email: GlobalEmailDetail; resent?: boolean; idempotent?: boolean }>(`/emails/${encodeURIComponent(id)}/resend`, idempotencyKey ? { idempotencyKey } : {});
  return data;
}

// ── M28-4: Bulk productivity actions (send email / enroll sequence) ───────────────────────────────
export interface BulkSendPreviewItem {
  recordId: string;
  recordName: string | null;
  status: 'ready' | 'skipped';
  reason?: string;
  to?: string;
  subject?: string;
  snippet?: string;
  unresolved?: string[];
  empty?: string[];
}
export interface BulkSendPreview {
  items: BulkSendPreviewItem[];
  summary: { ready: number; skipped: number; total: number };
  demo: boolean;
  disclaimer: string;
}
export interface BulkResultItem { recordId: string; status: 'succeeded' | 'skipped' | 'failed'; reason?: string; emailId?: string }
export interface BulkResult {
  results: BulkResultItem[];
  summary: { succeeded: number; skipped: number; failed: number; total: number };
  demo?: boolean;
  disclaimer?: string;
}
export async function bulkSendEmailPreview(recordIds: string[], input: { templateId?: string | null; subject: string; body: string }): Promise<BulkSendPreview> {
  const { data } = await crmApi.post<BulkSendPreview>('/bulk/send-email/preview', { recordIds, ...input });
  return data;
}
export async function bulkSendEmail(recordIds: string[], input: { templateId?: string | null; subject: string; body: string; idempotencyKey?: string }): Promise<BulkResult> {
  const { data } = await crmApi.post<BulkResult>('/bulk/send-email', { recordIds, ...input });
  return data;
}
export async function bulkEnrollSequence(recordIds: string[], campaignId: string): Promise<BulkResult> {
  const { data } = await crmApi.post<BulkResult>('/bulk/enroll-sequence', { recordIds, campaignId });
  return data;
}

// ── Массовое архивирование (S066) ────────────────────────────────────────────

export interface BulkArchiveResponse {
  archived: number;
  ids: string[];
}

export async function bulkArchiveRecords(ids: string[]): Promise<BulkArchiveResponse> {
  const { data } = await crmApi.post<BulkArchiveResponse>('/records/bulk-archive', { ids });
  return data;
}

// ── Импорт записей из CSV (маппинг колонок + дедуп) ──────────────────────────

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  total: number;
  dedupeKey: string | null;
  errors: { row: number; error: string }[];
}

export async function importRecords(params: {
  objectKey: string;
  rows: Array<Record<string, unknown>>;
  mapping: Record<string, string>;
  dedupeKey?: string;
}): Promise<ImportResult> {
  const { data } = await crmApi.post<ImportResult>('/records/import', params);
  return data;
}

// ── AI-SDR стадии (Pipeline) ─────────────────────────────────────────────────

export const AGENT_STAGES = [
  'sourced', 'researching', 'ready_to_engage', 'engaging', 'in_conversation',
  'meeting_set', 'handed_off', 'nurture', 'recycle', 'suppressed', 'disqualified',
] as const;
export type AgentStage = (typeof AGENT_STAGES)[number];

export async function bulkStageRecords(params: {
  objectKey: string;
  ids: string[];
  stage: AgentStage | string;
}): Promise<{ staged: number; stage: string }> {
  const { data } = await crmApi.post<{ staged: number; stage: string }>('/records/bulk-stage', params);
  return data;
}

export async function enrollRecordsToCampaign(params: {
  objectKey: string;
  recordIds: string[];
  campaignId: string;
}): Promise<{ enrolled: number; skipped: { name: string; reason: string }[]; campaign: { id: string; name: string } }> {
  const { data } = await crmApi.post<{
    enrolled: number;
    skipped: { name: string; reason: string }[];
    campaign: { id: string; name: string };
  }>('/records/enroll-campaign', params);
  return data;
}

// ── AI-атрибуты (S160–S173) ──────────────────────────────────────────────

export type AiAutofillType = 'CLASSIFY' | 'SUMMARIZE' | 'RESEARCH' | 'PROMPT';
export type AiRunSource = 'CELL' | 'RECORD_PAGE' | 'BOARD_CARD' | 'BULK';

export interface AiRunResponse {
  aiRunId: string;
  // M29-1: CONFLICT — текущее значение ручное (server 409), нужно подтверждение перезаписи (overwrite=true).
  status: 'SUCCEEDED' | 'FAILED' | 'QUEUED' | 'CONFLICT';
  value: Record<string, unknown> | null;
  creditTransaction: { id: string; amount: number; type: string } | null;
}

export interface AiBulkRunResponse {
  bulkRunId: string;
  estimatedCount: number;
  estimatedCost: number;
  status: 'QUEUED';
  scopeKind?: 'selected' | 'view';
  cappedFrom?: number | null;
}

export interface AiBulkPreflight {
  attribute: { id: string; name: string; aiType: AiAutofillType };
  scopeKind: 'selected' | 'view';
  cappedFrom: number | null;
  maxBulk: number;
  totalInScope: number;
  alreadyFilled: number;
  /** M29-1: записи с ручным значением — будут пропущены (не списываются). */
  manualProtected?: number;
  willRun: number;
  costPerRow: number;
  estimatedCredits: number;
  balance: number;
  sufficient: boolean;
}

export interface AiCreditBalance {
  balance: number;
  includedMonthly: number;
  usedThisPeriod: number;
  periodEnd: string | null;
  breakdown: Record<string, number>;
}

export interface AiCreditTransaction {
  id: string;
  orgId: string;
  amount: number;
  type: string;
  reason: string;
  aiRunId: string | null;
  recordId: string | null;
  attributeId: string | null;
  createdById: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AiRunStatus {
  id: string;
  orgId: string;
  recordId: string;
  attributeId: string;
  aiType: AiAutofillType;
  source: AiRunSource;
  creditCost: number;
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  output: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

/**
 * POST /api/attributes/:attributeId/ai/run
 * Запускает AI по одной записи (S166–S168).
 */
export async function runAiForRecord(params: {
  attributeId: string;
  recordId: string;
  source?: AiRunSource;
  overwrite?: boolean; // M29-1: явное согласие перезаписать ручное значение
}): Promise<AiRunResponse> {
  const { attributeId, recordId, source = 'CELL', overwrite } = params;
  try {
    const { data } = await crmApi.post<AiRunResponse>(
      `/attributes/${encodeURIComponent(attributeId)}/ai/run`,
      { recordId, source, overwrite },
    );
    return data;
  } catch (err: unknown) {
    // M29-1: 409 — значение правлено руками; не бросаем, возвращаем CONFLICT для подтверждения в UI.
    const status = (err as { response?: { status?: number } })?.response?.status;
    const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
    if (status === 409 && code === 'MANUAL_VALUE_CONFLICT') {
      return { aiRunId: '', status: 'CONFLICT', value: null, creditTransaction: null };
    }
    throw err;
  }
}

export interface AiProvenanceTimelineEvent {
  type: 'AI_FILLED' | 'AI_FAILED' | 'AI_SKIPPED' | 'REVIEW_APPROVED' | 'REVIEW_REJECTED' | 'REVIEW_EDITED';
  at: string;
  actor: string | null;
  cost: number;
  detail: string | null;
  status: string;
  /** M25-2: origin запуска (CELL/BOARD_CARD/BULK/AUTO…) — AUTO = auto-rerun по изменению зависимостей */
  source?: string | null;
}

export interface AiProvenance {
  attribute: { key: string; name: string; aiType: string | null; prompt: string | null; guidance: string | null };
  runCount: number;
  runsLimit?: number;
  hasMore?: boolean;
  currentValue?: string | null;
  confidence?: number | null;
  reviewable?: boolean;
  underReview?: boolean;
  threshold?: number | null;
  totalAiCost?: number;
  review?: {
    status: 'APPROVED' | 'REJECTED' | 'EDITED';
    decidedBy: string | null;
    decidedAt: string;
    confidence: number | null;
    note: string | null;
    valueBefore: string | null;
    valueAfter: string | null;
  } | null;
  timeline?: AiProvenanceTimelineEvent[];
  run: {
    id: string;
    aiType: string;
    status: string;
    creditsCost: number;
    outputText: string | null;
    input: { source?: string; displayName?: string; valuesText?: string } | null;
    error: string | null;
    requestedBy: string | null;
    startedAt: string | null;
    completedAt: string | null;
    createdAt: string;
  } | null;
}

/**
 * GET /api/attributes/:attributeId/ai/provenance?recordId=
 * Последний AiRun по записи+атрибуту — provenance для popover (M9).
 */
export async function getAiProvenance(attributeId: string, recordId: string): Promise<AiProvenance> {
  const { data } = await crmApi.get<AiProvenance>(
    `/attributes/${encodeURIComponent(attributeId)}/ai/provenance`,
    { params: { recordId } },
  );
  return data;
}

/**
 * POST /api/attributes/:attributeId/ai/run-view
 * Массовый запуск AI по view/выборке (S169).
 */
export interface AiBulkScopeParams {
  attributeId: string;
  // selected-scope
  recordIds?: string[];
  // view-scope (backend сам резолвит «текущий вид»)
  objectKey?: string;
  filters?: CrmViewFilter[];
  search?: string;
  viewId?: string;
  mode?: 'all_matching' | 'loaded_rows' | 'selected_rows';
  skipExisting?: boolean;
  clientRequestId?: string; // M25-1: идемпотентность bulk; если не задан — генерим uuid
}

export async function runAiBulkForView(params: AiBulkScopeParams): Promise<AiBulkRunResponse> {
  const { attributeId, clientRequestId, ...rest } = params;
  const reqId = clientRequestId ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `bulk-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const { data } = await crmApi.post<AiBulkRunResponse>(
    `/attributes/${encodeURIComponent(attributeId)}/ai/run-view`,
    { ...rest, clientRequestId: reqId },
  );
  return data;
}

/**
 * POST /api/attributes/:attributeId/ai/run-view/preflight
 * Превью billable-строк ДО запуска (M9.2): total/skipped/willRun/estimatedCredits.
 */
export async function runAiBulkPreflight(params: AiBulkScopeParams): Promise<AiBulkPreflight> {
  const { attributeId, ...body } = params;
  const { data } = await crmApi.post<AiBulkPreflight>(
    `/attributes/${encodeURIComponent(attributeId)}/ai/run-view/preflight`,
    body,
  );
  return data;
}

/**
 * GET /api/ai/runs/:aiRunId
 * Статус AI-run (для асинхронных Research runs, S164).
 */
export async function getAiRunStatus(aiRunId: string): Promise<AiRunStatus> {
  const { data } = await crmApi.get<AiRunStatus>(
    `/ai/runs/${encodeURIComponent(aiRunId)}`,
  );
  return data;
}

export interface AiBulkRunStatus {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  totalCount: number;
  pendingCount: number;
  successCount: number;
  failedCount: number;
  /** M29-1: строки с ручным значением — пропущены guard'ом (не ошибка, не списание). */
  skippedCount?: number;
  creditsReserved: number;
  creditsSpent: number;
  startedAt: string | null;
  completedAt: string | null;
}

export interface AiBulkRunRecordResult {
  id: string;
  recordId: string;
  // M29-1: SKIPPED_MANUAL_VALUE — строка пропущена (ручное значение), не ошибка и не списание.
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'SKIPPED_MANUAL_VALUE';
  creditsCost: number;
  error: string | null;
  outputText: string | null;
  completedAt: string | null;
}

/**
 * GET /api/ai/bulk-runs/:bulkRunId
 * Статус bulk AI-run: прогресс + ledger кредитов (S169, M9.2).
 */
export async function getAiBulkRunStatus(bulkRunId: string): Promise<AiBulkRunStatus> {
  const { data } = await crmApi.get<AiBulkRunStatus>(`/ai/bulk-runs/${encodeURIComponent(bulkRunId)}`);
  return data;
}

/**
 * GET /api/ai/bulk-runs/:bulkRunId/runs
 * Пер-рекордные результаты массового прогона — какие записи упали (частичные ошибки, M9.2).
 */
export async function getAiBulkRunRuns(bulkRunId: string): Promise<{ bulkRunId: string; count: number; runs: AiBulkRunRecordResult[] }> {
  const { data } = await crmApi.get<{ bulkRunId: string; count: number; runs: AiBulkRunRecordResult[] }>(
    `/ai/bulk-runs/${encodeURIComponent(bulkRunId)}/runs`,
  );
  return data;
}

/**
 * GET /api/billing/credits
 * Баланс AI-кредитов организации (S171).
 */
export async function getAiCreditBalance(): Promise<AiCreditBalance> {
  const { data } = await crmApi.get<AiCreditBalance>('/billing/credits');
  return data;
}

/**
 * GET /api/billing/credits/transactions
 * История транзакций кредитов (S172).
 */
export async function listAiCreditTransactions(params?: {
  page?: number;
  limit?: number;
  type?: string;
  userId?: string;
  from?: string;
  to?: string;
}): Promise<{ transactions: AiCreditTransaction[]; pagination: RecordsPagination }> {
  const { data } = await crmApi.get<{
    transactions: AiCreditTransaction[];
    pagination: RecordsPagination;
  }>('/billing/credits/transactions', { params });
  return data;
}

// ── AI review queue (M9.3) ───────────────────────────────────────────────────

export interface AiReviewItem {
  recordId: string;
  recordName: string;
  attributeKey: string;
  attributeName: string;
  aiValue: string | null;
  confidence: number | null;
  lastRunId: string | null;
}

export async function listAiReviewQueue(objectKey: string): Promise<{ items: AiReviewItem[]; total: number; threshold: number }> {
  const { data } = await crmApi.get<{ items: AiReviewItem[]; total: number; threshold: number }>(
    '/ai/review-queue',
    { params: { objectKey } },
  );
  return data;
}

export async function approveAiReview(recordId: string, attributeKey: string): Promise<void> {
  await crmApi.post('/ai/review/approve', { recordId, attributeKey });
}

export async function rejectAiReview(recordId: string, attributeKey: string): Promise<void> {
  await crmApi.post('/ai/review/reject', { recordId, attributeKey });
}

export async function editAiReview(recordId: string, attributeKey: string, value: string): Promise<void> {
  await crmApi.patch('/ai/review/edit', { recordId, attributeKey, value });
}

// ── AI metrics (M9.7) — метрики Data Hub из реальных AI-значений ──────────────
export interface AiMetrics {
  objectKey: string;
  totalRecords: number;
  aiAttributes: { key: string; name: string; aiType: string | null }[];
  aiFilled: number;
  aiCellsTotal: number;
  aiFilledPct: number;
  evidenceCoverage: number;
  recordsWithEvidence: number;
  needsReview: number;
  credits: { spentOnAi: number; remaining: number; used: number; includedMonthly: number };
  lastRunAt: string | null;
  lastRunStatus: string | null;
}

export async function getAiMetrics(objectKey: string): Promise<AiMetrics> {
  const { data } = await crmApi.get<AiMetrics>('/ai/metrics', { params: { objectKey } });
  return data;
}

// ── Lists (S100–S109) ────────────────────────────────────────────────────────

// LST-2: list-local стадия PIPELINE-списка (config.stages).
export interface PipelineStage {
  key: string;
  label: string;
  color?: string | null;
  order?: number;
}

export interface CrmList {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  type: 'STATIC' | 'DYNAMIC' | 'PIPELINE';
  isSystem?: boolean;
  // LST-1: config.rule (filterTree) у DYNAMIC. LST-2: config.stages у PIPELINE. null при restrictedSource.
  config?: { rule?: CrmFilterNode | null; stages?: PipelineStage[] } | null;
  primaryObject?: { id: string; key: string; singularName: string; pluralName: string; icon?: string | null };
  _count?: { entries?: number };
}

export interface ListRecordEntry extends CrmRecord {
  entryId: string | null;
  stage?: string | null;
}

// LST-1: ответ детали списка. Для DYNAMIC — matchedCount; при отсутствии OBJECT READ — restrictedSource+hiddenCount.
export interface ListDetailResponse {
  list: CrmList;
  records: ListRecordEntry[];
  matchedCount?: number;
  restrictedSource?: boolean;
  hiddenCount?: number;
  warnings?: string[];
}

export async function listLists(objectKey?: string): Promise<CrmList[]> {
  const { data } = await crmApi.get<{ lists: CrmList[] }>('/lists', { params: objectKey ? { objectKey } : undefined });
  return data.lists;
}

export async function getList(id: string): Promise<ListDetailResponse> {
  const { data } = await crmApi.get<ListDetailResponse>(`/lists/${encodeURIComponent(id)}`);
  return data;
}

export interface CreateListPayload {
  name: string;
  objectKey: string;
  description?: string;
  icon?: string;
  color?: string;
  type?: 'STATIC' | 'DYNAMIC' | 'PIPELINE';
  rule?: CrmFilterNode | null;
}
export async function createList(payload: CreateListPayload): Promise<CrmList & { matchedCount?: number; warnings?: string[] }> {
  const { data } = await crmApi.post<CrmList & { matchedCount?: number; warnings?: string[] }>('/lists', payload);
  return data;
}

export interface UpdateListPayload {
  name?: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  rule?: CrmFilterNode | null;
}
export async function updateList(id: string, payload: UpdateListPayload): Promise<CrmList & { matchedCount?: number; warnings?: string[] }> {
  const { data } = await crmApi.patch<CrmList & { matchedCount?: number; warnings?: string[] }>(`/lists/${encodeURIComponent(id)}`, payload);
  return data;
}

// LST-1: live-предпросмотр matchedCount правила DYNAMIC до сохранения.
export async function previewListRule(payload: { objectKey?: string; primaryObjectId?: string; rule: CrmFilterNode | null }): Promise<{ matchedCount: number; hasRule: boolean; warnings: string[]; truncated: boolean }> {
  const { data } = await crmApi.post<{ matchedCount: number; hasRule: boolean; warnings: string[]; truncated: boolean }>('/lists/preview-rule', payload);
  return data;
}

// LST-2: правка стадий PIPELINE-списка. moveToStage — куда переселить записи удаляемых стадий.
export async function updateListStages(id: string, stages: PipelineStage[], moveToStage?: string): Promise<CrmList> {
  const { data } = await crmApi.patch<CrmList>(`/lists/${encodeURIComponent(id)}/config`, { stages, ...(moveToStage ? { moveToStage } : {}) });
  return data;
}

// LST-2: перенос записи в стадию/позицию pipeline-списка (drag-persist).
export async function moveListEntry(listId: string, recordId: string, stage: string, position?: number): Promise<{ moved: boolean; from?: string | null; to?: string }> {
  const { data } = await crmApi.patch<{ moved: boolean; from?: string | null; to?: string }>(`/lists/${encodeURIComponent(listId)}/entries/${encodeURIComponent(recordId)}/move`, { stage, ...(position != null ? { position } : {}) });
  return data;
}

export async function archiveList(id: string): Promise<void> {
  await crmApi.delete(`/lists/${encodeURIComponent(id)}`);
}

export async function addListEntries(id: string, recordIds: string[]): Promise<{ added: number; requested: number; skipped: number }> {
  const { data } = await crmApi.post<{ added: number; requested: number; skipped: number }>(`/lists/${encodeURIComponent(id)}/entries`, { recordIds });
  return data;
}

export async function removeListEntry(id: string, recordId: string): Promise<void> {
  await crmApi.delete(`/lists/${encodeURIComponent(id)}/entries/${encodeURIComponent(recordId)}`);
}

// ── Meetings (ручной трекинг; календарь-синхронизация позже) ─────────────────

export type MeetingStatus = 'REQUESTED' | 'SCHEDULED' | 'COMPLETED' | 'NO_SHOW' | 'CANCELED';
export type MeetingOutcome = 'SHOWED' | 'NO_SHOW' | 'QUALIFIED' | 'NOT_QUALIFIED' | 'CANCELED';
export type CalendarSyncStatus = 'PENDING' | 'SYNCED' | 'FAILED' | 'NOT_CONNECTED' | 'CANCELED';
export interface CrmMeeting {
  id: string;
  title: string;
  leadId?: string | null;
  company?: string | null;
  scheduledAt?: string | null;
  durationMin: number;
  status: MeetingStatus;
  outcome?: string | null;
  outcomeType?: MeetingOutcome | null; // M15-4: типизированный исход
  notes?: string | null;
  source?: string | null;
  // M15-1: атрибуция встречи к источнику (reply/message/campaign).
  campaignId?: string | null;
  replyMessageId?: string | null;
  sourceMessageId?: string | null;
  attributionMode?: string | null;
  externalEventId?: string | null;
  syncStatus?: CalendarSyncStatus;
  syncError?: string | null;
  syncedAt?: string | null;
  createdAt: string;
}

export async function syncMeeting(id: string): Promise<CrmMeeting> {
  const { data } = await crmApi.post<CrmMeeting>(`/meetings/${encodeURIComponent(id)}/sync`);
  return data;
}

export interface CalendarStatus { connected: boolean; provider: string | null; connectedAt: string | null; canManage: boolean }
export async function getCalendarStatus(): Promise<CalendarStatus> {
  const { data } = await crmApi.get<CalendarStatus>('/settings/calendar');
  return data;
}
export async function connectCalendar(provider: 'GOOGLE' | 'OUTLOOK'): Promise<{ connected: boolean; provider: string; synced: number }> {
  const { data } = await crmApi.post<{ connected: boolean; provider: string; synced: number }>('/settings/calendar/connect', { provider });
  return data;
}
export async function disconnectCalendar(): Promise<{ connected: boolean }> {
  const { data } = await crmApi.post<{ connected: boolean }>('/settings/calendar/disconnect');
  return data;
}

export async function listMeetings(status?: string): Promise<{ meetings: CrmMeeting[]; counts: Record<string, number> }> {
  const { data } = await crmApi.get<{ meetings: CrmMeeting[]; counts: Record<string, number> }>('/meetings', { params: status ? { status } : undefined });
  return data;
}
export async function createMeeting(payload: { title?: string; leadId?: string; replyMessageId?: string; company?: string; scheduledAt?: string; durationMin?: number; status?: MeetingStatus; source?: string; notes?: string }): Promise<CrmMeeting & { duplicate?: boolean }> {
  const { data } = await crmApi.post<CrmMeeting & { duplicate?: boolean }>('/meetings', payload);
  return data;
}
// M15-4: типизированный исход встречи (sync лида/аудит/HandoffPackage на backend, идемпотентно).
export async function setMeetingOutcome(id: string, outcome: MeetingOutcome): Promise<{ ok: boolean; changed: boolean; leadStatus: string | null; meeting: CrmMeeting }> {
  const { data } = await crmApi.post<{ ok: boolean; changed: boolean; leadStatus: string | null; meeting: CrmMeeting }>(`/meetings/${encodeURIComponent(id)}/outcome`, { outcome });
  return data;
}
export async function updateMeeting(id: string, payload: { title?: string; scheduledAt?: string | null; durationMin?: number; status?: MeetingStatus; outcome?: string | null; notes?: string | null }): Promise<CrmMeeting> {
  const { data } = await crmApi.patch<CrmMeeting>(`/meetings/${encodeURIComponent(id)}`, payload);
  return data;
}
export async function archiveMeeting(id: string): Promise<void> {
  await crmApi.delete(`/meetings/${encodeURIComponent(id)}`);
}

// ── REL-2: обратная сторона связей (reverse relationships) ──
export interface ReverseRecordRef { id: string; displayName: string | null; href: string }
export interface ReverseGroup {
  attributeId: string; attributeKey: string; name: string; sourceObjectKey: string;
  reverseOfLabel: string | null; cardinality: string;
  total: number; hasMore: boolean; hiddenCount: number; records: ReverseRecordRef[]; editable: boolean;
}
export async function getReverseGroups(recordId: string): Promise<ReverseGroup[]> {
  const { data } = await crmApi.get<{ groups: ReverseGroup[] }>(`/records/${encodeURIComponent(recordId)}/reverse`);
  return data.groups;
}
export async function getReverseGroupPage(recordId: string, attributeId: string, skip: number, limit = 25): Promise<ReverseGroup> {
  const { data } = await crmApi.get<{ group: ReverseGroup }>(`/records/${encodeURIComponent(recordId)}/reverse/${encodeURIComponent(attributeId)}`, { params: { skip, limit } });
  return data.group;
}
export async function reverseLinkAdd(recordId: string, attributeId: string, sourceRecordId: string): Promise<ReverseGroup> {
  const { data } = await crmApi.post<{ group: ReverseGroup }>(`/records/${encodeURIComponent(recordId)}/reverse/${encodeURIComponent(attributeId)}`, { sourceRecordId });
  return data.group;
}
export async function reverseLinkRemove(recordId: string, attributeId: string, sourceRecordId: string): Promise<ReverseGroup> {
  const { data } = await crmApi.delete<{ group: ReverseGroup }>(`/records/${encodeURIComponent(recordId)}/reverse/${encodeURIComponent(attributeId)}/${encodeURIComponent(sourceRecordId)}`);
  return data.group;
}

export default crmApi;