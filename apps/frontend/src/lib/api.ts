import axios, { AxiosError } from 'axios';
import { getToken, logout } from './auth';
import type {
  AuthResponse,
  Lead,
  LeadsResponse,
  Campaign,
  Sequence,
  AnalyticsStats,
  GeneratedOutreach,
  CampaignStats,
  LoginForm,
  RegisterForm,
  CreateLeadForm,
  CreateCampaignForm,
  GenerateOutreachForm,
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token on every request
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      logout();
    }
    return Promise.reject(err);
  }
);

// ============ Auth ============

export const authApi = {
  login: (data: LoginForm) => api.post<AuthResponse>('/auth/login', data).then((r) => r.data),
  register: (data: RegisterForm) => api.post<AuthResponse>('/auth/register', data).then((r) => r.data),
  me: () => api.get<AuthResponse['user']>('/auth/me').then((r) => r.data),
};

// ============ Leads ============

export const leadsApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    country?: string;
    industry?: string;
  }) => api.get<LeadsResponse>('/leads', { params }).then((r) => r.data),

  get: (id: string) => api.get<Lead>(`/leads/${id}`).then((r) => r.data),

  create: (data: CreateLeadForm) => api.post<Lead>('/leads', data).then((r) => r.data),

  update: (id: string, data: Partial<CreateLeadForm>) =>
    api.put<Lead>(`/leads/${id}`, data).then((r) => r.data),

  delete: (id: string) => api.delete(`/leads/${id}`).then((r) => r.data),

  import: (csvContent: string) =>
    api.post<{ imported: number; skipped: number; total: number }>('/leads/import', { csvContent }).then((r) => r.data),

  search: (filters: {
    personTitles?: string[];
    personLocations?: string[];
    organizationNumEmployeesRanges?: string[];
    page?: number;
    perPage?: number;
    importToOrg?: boolean;
  }) => api.post('/leads/search', filters).then((r) => r.data),

  enrich: (id: string) => api.post<Lead>(`/leads/${id}/enrich`).then((r) => r.data),
};

// ============ Campaigns ============

export const campaignsApi = {
  list: () => api.get<Campaign[]>('/campaigns').then((r) => r.data),

  get: (id: string) => api.get<Campaign>(`/campaigns/${id}`).then((r) => r.data),

  create: (data: CreateCampaignForm) => api.post<Campaign>('/campaigns', data).then((r) => r.data),

  update: (id: string, data: Partial<CreateCampaignForm>) =>
    api.put<Campaign>(`/campaigns/${id}`, data).then((r) => r.data),

  delete: (id: string) => api.delete(`/campaigns/${id}`).then((r) => r.data),

  start: (id: string) =>
    api
      .post<{ campaign: Campaign; leadsEnrolled: number; nextSendAt: string }>(`/campaigns/${id}/start`)
      .then((r) => r.data),

  pause: (id: string) => api.post<Campaign>(`/campaigns/${id}/pause`).then((r) => r.data),
};

// ============ Sequences ============

export const sequencesApi = {
  list: (campaignId: string) =>
    api.get<Sequence[]>(`/sequences/${campaignId}`).then((r) => r.data),

  create: (
    campaignId: string,
    data: { stepNumber: number; delayDays: number; subject?: string; body: string; channel: string }
  ) => api.post<Sequence>(`/sequences/${campaignId}`, data).then((r) => r.data),

  update: (id: string, data: Partial<Sequence>) =>
    api.put<Sequence>(`/sequences/${id}`, data).then((r) => r.data),

  delete: (id: string) => api.delete(`/sequences/${id}`).then((r) => r.data),
};

// ============ Outreach ============

export const outreachApi = {
  generate: (data: GenerateOutreachForm) =>
    api.post<GeneratedOutreach>('/outreach/generate', data).then((r) => r.data),

  classify: (data: { messageBody: string; leadId?: string; messageId?: string }) =>
    api.post<{ classification: string }>('/outreach/classify', data).then((r) => r.data),

  autoReply: (data: {
    messageId: string;
    replyText: string;
    language?: string;
    calendlyUrl?: string;
    send?: boolean;
  }) =>
    api.post<{ subject: string; body: string }>('/outreach/auto-reply', data).then((r) => r.data),
};

// ============ Analytics ============

export const analyticsApi = {
  stats: () => api.get<AnalyticsStats>('/analytics/stats').then((r) => r.data),
  campaignStats: (id: string) =>
    api.get<CampaignStats>(`/analytics/campaign/${id}`).then((r) => r.data),
};

// ============ Billing ============

export const billingApi = {
  checkout: (plan: string) =>
    api.post<{ url: string }>('/billing/checkout', { plan }).then((r) => r.data),
  portal: () => api.get<{ url: string }>('/billing/portal').then((r) => r.data),
  subscription: () => api.get('/billing/subscription').then((r) => r.data),
};

export default api;
