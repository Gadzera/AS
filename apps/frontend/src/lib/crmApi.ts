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
  objectKey?: string | null;
  name: string;
  key?: string | null;
  type: CrmViewType;
  isDefault?: boolean;
  order?: number;
  groupByAttributeKey?: string | null;
  config?: Record<string, unknown> | null;
  filters?: CrmViewFilter[];
  sorts?: CrmViewSort[];
  columns?: CrmViewColumn[];
}

export interface CrmObject {
  id: string;
  key: string;
  singularName: string;
  pluralName: string;
  icon?: string | null;
  color?: string | null;
  isSystem: boolean;
}

export interface CrmObjectDetail extends CrmObject {
  attributes: CrmAttribute[];
  views: CrmView[];
}

export interface CrmRecord {
  id: string;
  objectKey: string;
  displayName: string;
  values: Record<string, CrmRecordValue>;
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
  sorts?: CrmViewSort[];
  columns?: CrmViewColumn[];
}

export interface ListRecordsResponse {
  records: CrmRecord[];
  pagination: RecordsPagination;
}

export interface CreateViewPayload {
  objectKey: string;
  name: string;
  type: CrmViewType;
  filters?: CrmViewFilter[];
  sorts?: CrmViewSort[];
  columns?: CrmViewColumn[];
}

export interface UpdateViewPayload {
  name?: string;
  type?: CrmViewType;
  filters?: CrmViewFilter[];
  sorts?: CrmViewSort[];
  columns?: CrmViewColumn[];
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

export async function listRecords(params: ListRecordsParams): Promise<ListRecordsResponse> {
  const { objectKey, page = 1, limit = 50, search = '', filters = [], sorts = [], columns = [] } = params;

  const { data } = await crmApi.get<ListRecordsResponse>('/records', {
    params: {
      objectKey,
      page,
      limit,
      search,
      filters: encodeJsonParam(filters),
      sorts: encodeJsonParam(sorts),
      columns: encodeJsonParam(columns),
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

export async function listViews(objectKey: string): Promise<CrmView[]> {
  const { data } = await crmApi.get<{ views: CrmView[] }>('/views', {
    params: { objectKey },
  });

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

export default crmApi;