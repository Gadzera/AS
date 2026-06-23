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

// Handle 401 globally — ТОЛЬКО как истечение сессии: был токен, и это не сам auth-запрос.
// Иначе 401 при неверном пароле на /login дёргал logout()→редирект, стирал баннер ошибки и
// ломал форму (пользователь не успевал прочитать «Invalid credentials»). Ошибку входа/регистрации
// отдаём странице — она покажет баннер.
api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    const url = err.config?.url ?? '';
    const isAuthAttempt = url.includes('/auth/login') || url.includes('/auth/register');
    if (err.response?.status === 401 && typeof window !== 'undefined' && !isAuthAttempt && getToken()) {
      logout();
    }
    return Promise.reject(err);
  }
);

// ============ Auth ============

export type LoginResult = AuthResponse | { requiresTwoFactor: true; challenge: string };

export const authApi = {
  login: (data: LoginForm) => api.post<LoginResult>('/auth/login', data).then((r) => r.data),
  verifyLogin: (challenge: string, code: string) => api.post<AuthResponse>('/auth/2fa/verify-login', { challenge, code }).then((r) => r.data),
  register: (data: RegisterForm) => api.post<AuthResponse>('/auth/register', data).then((r) => r.data),
  me: () => api.get<AuthResponse['user'] & { themePref?: 'light' | 'dark' | null }>('/auth/me').then((r) => r.data),
  updateProfile: (name: string) => api.patch<AuthResponse['user']>('/auth/me', { name }).then((r) => r.data),
  setTheme: (themePref: 'light' | 'dark') => api.patch<{ themePref: 'light' | 'dark' | null }>('/auth/me', { themePref }).then((r) => r.data),
  forgotPassword: (email: string) =>
    api.post<{ ok: boolean; message: string; demo?: boolean; demoToken?: string }>('/auth/forgot-password', { email }).then((r) => r.data),
  resetPassword: (token: string, password: string) =>
    api.post<{ ok: boolean; message: string }>('/auth/reset-password', { token, password }).then((r) => r.data),
  // M23-1: change-password возвращает НОВЫЙ токен (текущая сессия продолжает жить)
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<{ ok: boolean; message: string; token: string }>('/auth/change-password', { currentPassword, newPassword }).then((r) => r.data),
};

// ============ Security: sessions + 2FA (M23-1) ============
export interface DeviceSession { id: string; userAgent: string | null; createdAt: string; lastSeenAt: string; current: boolean }
export interface TwoFactorStatus { enabled: boolean; pending: boolean; recoveryLeft: number }
export const securityApi = {
  sessions: () => api.get<{ sessions: DeviceSession[] }>('/security/sessions').then((r) => r.data.sessions),
  revokeSession: (id: string) => api.delete<{ ok: boolean }>(`/security/sessions/${id}`).then((r) => r.data),
  revokeOthers: () => api.post<{ ok: boolean; revoked: number }>('/security/sessions/revoke-others', {}).then((r) => r.data),
  twoFactor: () => api.get<TwoFactorStatus>('/security/2fa').then((r) => r.data),
  setup2fa: () => api.post<{ secret: string; otpauthUri: string }>('/security/2fa/setup', {}).then((r) => r.data),
  verify2fa: (code: string) => api.post<{ ok: boolean; recoveryCodes: string[] }>('/security/2fa/verify', { code }).then((r) => r.data),
  disable2fa: (code: string) => api.post<{ ok: boolean }>('/security/2fa/disable', { code }).then((r) => r.data),
  regenRecovery: (code: string) => api.post<{ ok: boolean; recoveryCodes: string[] }>('/security/2fa/recovery-codes', { code }).then((r) => r.data),
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

  // Lead 360 — единая карточка (state + counts + timeline из реальных источников).
  timeline: (id: string) => api.get<LeadTimeline>(`/leads/${id}/timeline`).then((r) => r.data),

  // Добавить лида в последовательность (CampaignLead). 409 если уже в ней.
  enroll: (id: string, campaignId: string) =>
    api.post<{ enrolled: boolean; campaignName: string }>(`/leads/${id}/enroll`, { campaignId }).then((r) => r.data),

  // M11-3: пауза/возобновление enrollment'а лида в кампании. 409 если статус не допускает.
  pauseEnrollment: (id: string, campaignId: string) =>
    api.post<{ ok: boolean; status: string; nextSendAt: string | null }>(`/leads/${id}/enrollment/pause`, { campaignId }).then((r) => r.data),
  resumeEnrollment: (id: string, campaignId: string) =>
    api.post<{ ok: boolean; status: string; nextSendAt: string | null }>(`/leads/${id}/enrollment/resume`, { campaignId }).then((r) => r.data),

  // M11-7: массовое зачисление выбранных лидов в кампанию (dedupe + аудит). Сводка skipped/reason.
  enrollBulk: (campaignId: string, leadIds: string[]) =>
    api.post<{ enrolled: number; skipped: { leadId: string; reason: string }[]; requested: number; campaign: { id: string; name: string } }>(`/leads/enroll-bulk`, { campaignId, leadIds }).then((r) => r.data),
  // M11-7: снять лида с кампании (unenroll) + аудит SEQUENCE_EXITED.
  unenroll: (id: string, campaignId: string) =>
    api.delete<{ ok: boolean; unenrolled: boolean }>(`/leads/${id}/enrollment`, { params: { campaignId } }).then((r) => r.data),
};

// ── Lead 360 timeline ────────────────────────────────────────────────────────

export type TimelineKind = 'email' | 'reply' | 'call' | 'meeting' | 'workflow' | 'enrollment';

export interface TimelineEvent {
  id: string;
  kind: TimelineKind;
  title: string;
  detail: string;
  at: string;
}

export interface LeadTimelineState {
  status: string;
  score: number;
  owner: string | null;
  activeSequence: {
    campaignId: string;
    name: string;
    status: string;
    stopReason: string | null;
    pausedAt: string | null;
    completedAt: string | null;
    currentStep: number;
    totalSteps: number;
    nextSendAt: string | null;
  } | null;
  nextActionAt: string | null;
  lastTouchAt: string | null;
}

export interface LeadTimeline {
  lead: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    title: string | null;
    company: string | null;
    industry: string | null;
    country: string | null;
    city: string | null;
    website: string | null;
    linkedinUrl: string | null;
    score: number;
    status: string;
  };
  state: LeadTimelineState;
  counts: { emails: number; replies: number; calls: number; meetings: number; automations: number };
  timeline: TimelineEvent[];
}

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

  pause: (id: string) => api.post<Campaign & { enrollmentsPaused: number }>(`/campaigns/${id}/pause`).then((r) => r.data),
  // M11-4: возобновление кампании (PAUSED → ACTIVE) + возврат её enrollment'ов в расписание.
  resume: (id: string) => api.post<Campaign & { enrollmentsResumed: number }>(`/campaigns/${id}/resume`).then((r) => r.data),
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

  // M11-9: переупорядочить шаги. Активные enrolled лиды мигрируются по идентичности шага
  // (migratedEnrollments сообщает, скольких затронуло — изменение не молчаливое).
  reorder: (campaignId: string, orderedIds: string[]) =>
    api.post<{ reordered: number; activeEnrollments: number; migratedEnrollments: number; steps: Sequence[] }>(`/sequences/${campaignId}/reorder`, { orderedIds }).then((r) => r.data),

  // AI пишет последовательность под кампанию (DeepSeek; demo без ключа).
  generate: (
    campaignId: string,
    data?: {
      steps?: number;
      language?: 'en' | 'ru' | 'de';
      tone?: 'professional' | 'casual' | 'friendly';
      valueProposition?: string;
      senderName?: string;
      senderCompany?: string;
      replace?: boolean;
    }
  ) =>
    api
      .post<{ sequences: Sequence[]; generatedBy: 'deepseek' | 'anthropic' | 'demo' }>(
        `/sequences/${campaignId}/generate`,
        data ?? {}
      )
      .then((r) => r.data),

  overview: (campaignId: string) =>
    api.get<SequenceOverview>(`/sequences/${campaignId}/overview`).then((r) => r.data),
};

export interface SequenceOverview {
  campaign: { id: string; name: string; status: string; channel: string; dailyLimit: number; createdAt: string };
  steps: Sequence[];
  enrollment: {
    total: number;
    byStep: { stepNumber: number; atStep: number }[];
    byStatus: Record<string, number>;
    dueNow: number;
  };
  engine: {
    dailyLimit: number;
    effectiveLimit: number;
    warmupStage: string;
    warmupActive: boolean;
    sentToday: number;
    totalSent: number;
    remainingToday: number;
    schedulerActive: boolean;
    window: { start: string; end: string; days: string[]; timezone: string } | null;
    mailbox: { address: string; status: string; provider: string } | null;
  };
}

// ============ Outreach ============

export interface ReplyMessage {
  id: string;
  body: string;
  subject: string | null;
  replyClass: 'INTERESTED' | 'NOT_INTERESTED' | 'FOLLOW_UP' | 'UNSUBSCRIBE' | null;
  createdAt: string;
  repliedAt: string | null;
  handledAt: string | null;
  // M14-1/M14-2: intent-конвейер + атрибуция (из backend; UI не пересчитывает).
  intent: 'INTERESTED' | 'NOT_INTERESTED' | 'FOLLOW_UP' | 'UNSUBSCRIBE' | null;
  intentConfidence: number | null; // 0..1
  intentSource: 'AUTO' | 'HUMAN' | null;
  attribution: { campaignId: string | null; campaignName: string | null; attributionMode: string | null; replyToMessageId: string | null };
  repliedToOutbound: { id: string; subject: string | null; snippet: string; sentAt: string | null } | null;
  // M14-5: origin авто-ответа (backend-computed label) — Auto-sent / Replied / Needs approval / Handoff / Suppressed.
  autoResponse: { origin: 'MANUAL' | 'AUTOPILOT' | 'HANDOFF'; draftStatus: 'DRAFT' | 'APPROVED' | 'SENT' | 'SUPPRESSED'; riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'; label: string | null } | null;
  lead: {
    id: string;
    firstName: string;
    lastName: string;
    company: string | null;
    title: string | null;
    email: string | null;
    status: string;
    score: number;
  };
}

export interface RepliesResponse {
  replies: ReplyMessage[];
  counts: Record<string, number>;
  total: number;
}

// M14-3: AI-черновик ответа + approval-gate. Статус и risk считает backend; UI не пересчитывает.
export interface ReplyDraft {
  id: string;
  status: 'DRAFT' | 'APPROVED' | 'SENT' | 'SUPPRESSED';
  subject: string | null;
  body: string;
  originalBody: string | null; // снимок ДО ручной правки (before/after)
  riskFlags: string[]; // backend-derived
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  canAutopilot: boolean; // false при high-risk/low-confidence/fallback
  generatedBy: string; // deepseek | demo
  editedById: string | null;
  approvedById: string | null;
  approvedAt: string | null;
  sentMessageId: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const outreachApi = {
  generate: (data: GenerateOutreachForm) =>
    api.post<GeneratedOutreach>('/outreach/generate', data).then((r) => r.data),

  classify: (data: { messageBody: string; leadId?: string; messageId?: string }) =>
    api.post<{ classification: string }>('/outreach/classify', data).then((r) => r.data),

  replies: (cls?: string) =>
    api
      .get<RepliesResponse>('/outreach/replies', { params: cls ? { class: cls } : undefined })
      .then((r) => r.data),

  runNow: (campaignId: string, max = 25) =>
    api
      .post<{ processed: number; sent: number; errors: { id: string; error: string }[] }>('/outreach/run-now', { campaignId, max })
      .then((r) => r.data),

  autoReply: (data: {
    messageId: string;
    replyText: string;
    language?: string;
    calendlyUrl?: string;
    send?: boolean;
  }) =>
    api.post<{ subject: string; body: string }>('/outreach/auto-reply', data).then((r) => r.data),

  // Ручная переклассификация входящего (human override) — меняет класс + статус лида.
  setReplyClass: (id: string, cls: 'INTERESTED' | 'NOT_INTERESTED' | 'FOLLOW_UP' | 'UNSUBSCRIBE') =>
    api
      .post<{ ok: boolean; class: string; leadStatus: string }>(`/outreach/replies/${id}/set-class`, { class: cls })
      .then((r) => r.data),

  // Записать ответ агента на входящее (demo-доставка) — создаёт OUTBOUND-сообщение.
  respond: (id: string, data: { subject?: string; body: string }) =>
    api
      .post<{ ok: boolean; messageId: string; delivered: boolean }>(`/outreach/replies/${id}/respond`, data)
      .then((r) => r.data),

  // ── M14-3: AI reply draft + approval gate ──
  // Текущий черновик ответа на входящее (если есть).
  getDraft: (replyId: string) =>
    api.get<{ ok: boolean; draft: ReplyDraft | null }>(`/outreach/replies/${replyId}/draft`).then((r) => r.data.draft),
  // Сгенерировать/перегенерировать черновик (один активный DRAFT на reply — без orphan).
  generateDraft: (replyId: string) =>
    api.post<{ ok: boolean; draft: ReplyDraft | null }>(`/outreach/replies/${replyId}/draft`, {}).then((r) => r.data.draft),
  // Ручная правка (снимок before/after в originalBody).
  editDraft: (draftId: string, body: string) =>
    api.post<{ ok: boolean }>(`/outreach/drafts/${draftId}/edit`, { body }).then((r) => r.data),
  // Approve + send как одно controlled action (M14-4: thread-safe, через M12-lifecycle, идемпотентно).
  approveSendDraft: (draftId: string) =>
    api.post<{ ok: boolean; messageId: string; status?: 'SENT' | 'FAILED'; mailboxId?: string; alreadySent?: boolean }>(`/outreach/drafts/${draftId}/approve-send`, {}).then((r) => r.data),
  // Снять черновик / передать человеку (без отправки).
  suppressDraft: (draftId: string) =>
    api.post<{ ok: boolean }>(`/outreach/drafts/${draftId}/suppress`, {}).then((r) => r.data),

  // M15-2: назначить встречу из заинтересованного ответа (атрибуция + идемпотентность на backend).
  scheduleMeeting: (replyId: string, data: { scheduledAt?: string; durationMin?: number; title?: string }) =>
    api.post<{ ok: boolean; meetingId: string; duplicate: boolean; workflowsTriggered: number }>(`/outreach/replies/${replyId}/schedule-meeting`, data).then((r) => r.data),

  // ── M15-3: Handoff package ──
  getHandoff: (params: { replyMessageId?: string; meetingId?: string; leadId?: string }) =>
    api.get<{ ok: boolean; handoff: HandoffPackage; built: string }>('/outreach/handoff', { params }).then((r) => r.data),
  assignHandoff: (handoffId: string, assigneeId: string | null) =>
    api.post<{ ok: boolean; handoff: HandoffPackage }>(`/outreach/handoff/${handoffId}/assign`, { assigneeId }).then((r) => r.data),
  handOff: (handoffId: string) =>
    api.post<{ ok: boolean; handoff: HandoffPackage }>(`/outreach/handoff/${handoffId}/hand-off`, {}).then((r) => r.data),
};

// M15-3: пакет передачи человеку/AE — персистентная сущность (backend собирает из реальных источников).
export interface HandoffPackage {
  id: string;
  replyMessageId: string;
  leadId: string;
  campaignId: string | null;
  campaignName: string | null;
  meetingId: string | null;
  meeting: { id: string; scheduledAt: string | null; status: string; title: string } | null;
  intent: 'INTERESTED' | 'NOT_INTERESTED' | 'FOLLOW_UP' | 'UNSUBSCRIBE' | null;
  intentConfidence: number | null;
  attributionMode: string | null;
  riskFlags: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  summary: string;
  recommendedNextStep: string;
  threadSnapshot: { direction: string; subject: string | null; body: string; at: string }[];
  status: 'OPEN' | 'ASSIGNED' | 'HANDED_OFF';
  assigneeId: string | null;
  assignee: { id: string; name: string; email: string } | null;
  assignableUsers: { id: string; name: string; email: string }[];
  lead: { id: string; firstName: string; lastName: string; company: string | null; title: string | null; score: number } | null;
  viewedAt: string | null;
  handedOffAt: string | null;
}

// ============ Analytics ============

export interface ReportsData {
  efficiency: { totalSent: number; totalOpened: number; totalReplies: number; totalBounced: number; sentToday: number; openRate: number; replyRate: number; bounceRate: number; meetingRate: number; conversionRate: number };
  replyAttribution: { total: number; exact: number; fallbackAttributed: number };
  // M14-5: авто-ответ — auto-sent / human-approved / handoff / suppressed / failed (backend-computed).
  autoResponse: { enabled: boolean; minConfidence: number; autoSent: number; humanApproved: number; handoff: number; suppressed: number; failedAutoSend: number; needsApproval: number };
  funnel: { stage: string; value: number }[];
  repliesByClass: Record<string, number>;
  meetings: { byStatus: Record<string, number>; total: number; completed: number; showRate: number;
    // M15-4/M15-5: исходы + split по источнику (backend-computed).
    outcomes: { scheduled: number; showed: number; no_show: number; qualified: number; not_qualified: number; canceled: number };
    bySource: { reply: number; manual: number; call: number };
  };
  // M15-5: handoff conversion chain (из linked HandoffPackage/Meeting).
  handoff: { open: number; assigned: number; handed_off: number; meeting_scheduled: number; qualified: number; total: number; handoffToMeetingRate: number };
  sequenceImpact: { id: string; name: string; status: string; channel: string; enrolled: number; sent: number; replied: number; converted: number; completed: number; replyRate: number; meetings: number; qualifiedMeetings: number }[];
  workflowImpact: { totalRuns: number; activeRules: number; totalRules: number; byTrigger: Record<string, number> };
  capacity: {
    dailyCapacity: number; usedToday: number; remaining: number; mailboxes: number; totalMailboxes: number;
    perMailbox: { id: string; address: string; status: string; warmupDay: number; healthPct: number; effectiveLimit: number; usedToday: number; remaining: number }[];
    retriesScheduled: number; failedTerminal: number;
  };
  leadsByStatus: Record<string, number>;
  demoNote: string;
  filters: { campaign: string | null; scopedLeads: number | null };
  availableCampaigns: { id: string; name: string }[];
}

export interface DrillLead { id: string; name: string; company: string | null; title: string | null; status: string; score: number; href: string }
export interface DrillResponse { stage: string; total: number; leads: DrillLead[] }
export interface SavedReport { id: string; name: string; reportType: string; filters: { campaign?: string | null; period?: number }; createdAt: string }

export interface TrendsPoint { date: string; iso: string; sent: number; replies: number; meetings: number }
export interface TrendsData { days: number; series: TrendsPoint[]; totals: { sent: number; replies: number; meetings: number } }

export type SendSkipReason = 'NO_MAILBOX' | 'DAILY_LIMIT' | 'NO_EMAIL' | 'NO_LINKEDIN' | 'CAMPAIGN_INACTIVE' | 'OUTSIDE_WINDOW' | 'SEND_FAILED';
export interface SendSkipItem { id: string; reason: SendSkipReason; detail: string | null; leadName: string | null; campaignName: string | null; at: string }
export interface SkipsData { days: number; total: number; reasons: Partial<Record<SendSkipReason, number>>; recent: SendSkipItem[]; heldNow: number }

export const analyticsApi = {
  stats: () => api.get<AnalyticsStats>('/analytics/stats').then((r) => r.data),
  campaignStats: (id: string) =>
    api.get<CampaignStats>(`/analytics/campaign/${id}`).then((r) => r.data),
  reports: (campaign?: string) => api.get<ReportsData>('/analytics/reports', { params: campaign ? { campaign } : {} }).then((r) => r.data),
  trends: (days: 7 | 30 | 90) => api.get<TrendsData>('/analytics/trends', { params: { days } }).then((r) => r.data),
  skips: (days: 1 | 7 | 30 = 7) => api.get<SkipsData>('/analytics/skips', { params: { days } }).then((r) => r.data),
  drill: (stage: string, campaign?: string) => api.get<DrillResponse>('/analytics/drill', { params: { stage, ...(campaign ? { campaign } : {}) } }).then((r) => r.data),
  savedList: () => api.get<{ reports: SavedReport[] }>('/analytics/saved').then((r) => r.data),
  savedCreate: (name: string, reportType: string, filters: { campaign?: string | null; period?: number }) => api.post<{ report: SavedReport }>('/analytics/saved', { name, reportType, filters }).then((r) => r.data),
  savedDelete: (id: string) => api.delete<{ ok: boolean }>(`/analytics/saved/${id}`).then((r) => r.data),
};

// ============ Billing ============

// M16-3: единый billing-overview (numbers из backend, без client recompute).
export interface BillingOverview {
  plan: string;
  subscriptionStatus: string;
  hasSubscription: boolean;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  planMonthly: number;
  credits: { monthly: number; purchased: number; used: number; remaining: number; periodStart: string | null; periodEnd: string | null } | null;
  ledger: { id: string; source: string; type: string; amount: number; reason: string | null; balanceAfter: number; link: string | null; createdAt: string }[];
  // M16-5: usage/audit из единого источника (CreditTransaction).
  usage: { periodStart: string | null; totalSpent: number; granted: number; byModule: Record<string, number>; bulkSpend: number; adjustments: { count: number; entries: { before: unknown; after: unknown; reason: string | null; at: string }[] } };
}

export interface StripeWebhookEvent { eventId: string; type: string; status: string; attempts: number; processedAt: string | null; error: string | null; createdAt: string }

export const billingApi = {
  checkout: (plan: string) =>
    api.post<{ url?: string; demo?: boolean; message?: string }>('/billing/checkout', { plan }).then((r) => r.data),
  portal: () => api.get<{ url: string }>('/billing/portal').then((r) => r.data),
  subscription: () => api.get('/billing/subscription').then((r) => r.data),
  // M16-3
  overview: () => api.get<BillingOverview>('/billing/overview').then((r) => r.data),
  reconcile: () => api.post<{ ok: boolean; adjusted: boolean; before?: { used: number; remaining: number }; after?: { used: number; remaining: number } }>('/billing/reconcile', {}).then((r) => r.data),
  // M16-5
  webhookEvents: () => api.get<{ events: StripeWebhookEvent[] }>('/billing/webhook-events').then((r) => r.data.events),
  ledgerExport: (format: 'csv' | 'json' = 'csv') =>
    api.get<string>('/billing/ledger/export', { params: { format }, responseType: 'text', transformResponse: [(d) => d] }).then((r) => r.data),
};

// ============ Overview (cockpit aggregates) ============

export interface OverviewSummary {
  records: { total: number; objects: number };
  ai: { runsTotal: number; runsToday: number; credits: { balance: number; used: number; included: number } };
  campaigns: { total: number; active: number; paused: number; draft: number; enrolled: number; enrolledActive: number };
}

export interface OnboardingStep { key: string; label: string; description: string; done: boolean; count: number; href: string }
export interface OnboardingState { steps: OnboardingStep[]; completed: number; total: number; complete: boolean; isNew: boolean }

export const overviewApi = {
  get: () => api.get<OverviewSummary>('/overview').then((r) => r.data),
  onboarding: () => api.get<OnboardingState>('/overview/onboarding').then((r) => r.data),
};

// ============ Team ============

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive?: boolean;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  actorName: string | null;
  action: string;
  targetType: string | null;
  summary: string;
  createdAt: string;
}

export const teamApi = {
  members: () => api.get<{ members: TeamMember[]; total: number; canManage: boolean; isOwner: boolean }>('/team/members').then((r) => r.data),
  invite: (data: { email: string; name: string; role?: 'ADMIN' | 'MEMBER' }) =>
    api.post<{ member: TeamMember; demo: boolean; tempPassword: string; message: string }>('/team/invite', data).then((r) => r.data),
  setRole: (id: string, role: 'ADMIN' | 'MEMBER') =>
    api.patch<{ member: TeamMember }>(`/team/members/${id}`, { role }).then((r) => r.data),
  setActive: (id: string, isActive: boolean) =>
    api.patch<{ member: TeamMember }>(`/team/members/${id}/active`, { isActive }).then((r) => r.data),
  remove: (id: string) => api.delete<{ ok: boolean }>(`/team/members/${id}`).then((r) => r.data),
  audit: () => api.get<{ entries: AuditEntry[] }>('/team/audit').then((r) => r.data),
};

// ============ Notifications ============

export type NotificationSource = 'WORKFLOW' | 'REPLY' | 'MEETING' | 'CALL' | 'SYSTEM';
export type NotificationStatus = 'NEW' | 'READ' | 'DONE' | 'DISMISSED';
export type NotificationType = 'MENTION' | 'REPLY' | 'TASK_ASSIGNED' | 'RECORD_ASSIGNED' | 'SYSTEM';

export interface Notification {
  id: string;
  source: NotificationSource;
  type: NotificationType;
  readAt: string | null; // per-user (M22-1)
  status?: NotificationStatus;
  title: string;
  body: string | null;
  leadId: string | null;
  leadName: string | null;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  counts: Record<string, number>; // по типам (ALL/MENTION/REPLY/SYSTEM/…) — непрочитанные
  liveTypes: NotificationType[]; // типы с реальными fire-site'ами (остальные в UI disabled)
}

export interface DigestItem { id: string; type: NotificationType; title: string; body: string | null; createdAt: string; redacted: boolean }
export interface DigestPreview { items: DigestItem[]; count: number; redactedCount: number; smtpConfigured: boolean; periodStart: string; periodEnd: string }
export type DigestStatus = 'SENT' | 'SKIPPED_NO_SMTP' | 'EMPTY';

export const notificationsApi = {
  list: (type?: string) => api.get<NotificationsResponse>('/notifications', { params: type ? { type } : {} }).then((r) => r.data),
  count: () => api.get<{ unread: number }>('/notifications/count').then((r) => r.data),
  create: (data: { title: string; body?: string; leadId?: string }) => api.post<{ ok: boolean }>('/notifications', data).then((r) => r.data),
  markRead: (id: string, read = true) => api.patch<{ ok: boolean }>(`/notifications/${id}`, { read }).then((r) => r.data),
  readAll: () => api.post<{ updated: number }>('/notifications/read-all').then((r) => r.data),
  digest: (hours = 24) => api.get<DigestPreview>('/notifications/digest', { params: { hours } }).then((r) => r.data),
  sendDigest: () => api.post<{ status: DigestStatus; count: number; redactedCount: number; messageId: string | null }>('/notifications/digest/send', {}).then((r) => r.data),
};

// ============ Onboarding / Demo mode (M22-2) ============
export interface OnboardingStatus {
  bootstrapped: boolean; completed: boolean; onboardingCompletedAt: string | null; workspaceName: string | null;
  objectCount: number; recordCount: number;
  capabilities: { email: boolean; ai: boolean; billing: boolean };
}
export const onboardingApi = {
  status: () => api.get<OnboardingStatus>('/onboarding/status').then((r) => r.data),
  complete: () => api.post<{ ok: boolean; alreadyCompleted: boolean; objectCount: number }>('/onboarding/complete', {}).then((r) => r.data),
};

// ============ Comments (M22-1) ============
export interface CommentUser { id: string; name: string; email: string }
export interface CommentNode {
  id: string; parentId: string | null; authorId: string; author: CommentUser | null;
  body: string; deleted: boolean; editedAt: string | null; createdAt: string;
  mentions: CommentUser[]; replies?: CommentNode[];
}
export interface MentionSkip { userId: string; reason: 'not-in-workspace' | 'inactive' | 'no-access' }
export interface CommentsResponse { comments: CommentNode[]; users: CommentUser[]; mentionable: CommentUser[] }
export interface CreateCommentResponse { comment: { id: string }; mentions: string[]; mentionsSkipped: MentionSkip[] }

export const commentsApi = {
  list: (recordId: string) => api.get<CommentsResponse>(`/records/${recordId}/comments`).then((r) => r.data),
  create: (recordId: string, body: string, parentId?: string) => api.post<CreateCommentResponse>(`/records/${recordId}/comments`, { body, parentId }).then((r) => r.data),
  edit: (recordId: string, commentId: string, body: string) => api.patch<CreateCommentResponse>(`/records/${recordId}/comments/${commentId}`, { body }).then((r) => r.data),
  remove: (recordId: string, commentId: string) => api.delete<{ ok: boolean }>(`/records/${recordId}/comments/${commentId}`).then((r) => r.data),
};

// ============ Calls ============

export type CallDirection = 'OUTBOUND' | 'INBOUND';
export type CallStatus = 'SCHEDULED' | 'COMPLETED' | 'NO_ANSWER' | 'VOICEMAIL' | 'CANCELED';
export type CallOutcome = 'CONNECTED' | 'NO_ANSWER' | 'VOICEMAIL' | 'NOT_INTERESTED' | 'CALLBACK' | 'MEETING_BOOKED' | 'WRONG_NUMBER';

export interface Call {
  id: string;
  leadId: string | null;
  lead: { id: string; name: string; company: string | null } | null;
  direction: CallDirection;
  status: CallStatus;
  outcome: CallOutcome | null;
  scheduledAt: string | null;
  durationSec: number;
  notes: string | null;
  transcript: string | null;
  transcriptSource: string | null;
  summary: string | null;
  nextStep: string | null;
  aiIntent: string | null;
  aiObjections: string[];
  aiRisk: string | null;
  favorite?: boolean;
  createdAt: string;
}

export interface CallsResponse {
  calls: Call[];
  counts: Record<string, number>;
  outcomes: Record<string, number>;
  summary: { total: number; scheduled: number; completed: number; connectRate: number; meetingsBooked: number };
}

export interface CallEffects { leadStatus?: string; meetingCreated?: boolean; workflowsTriggered?: number }

export const callsApi = {
  list: (opts?: string | { status?: string; favorite?: boolean; mine?: boolean; recordId?: string }) => {
    const o = typeof opts === 'string' ? { status: opts } : (opts ?? {});
    const params: Record<string, string> = {};
    if (o.status) params.status = o.status;
    if (o.favorite) params.favorite = 'true';
    if (o.mine) params.mine = 'true';
    if (o.recordId) params.recordId = o.recordId;
    return api.get<CallsResponse>('/calls', { params }).then((r) => r.data);
  },
  create: (data: { leadId?: string; direction?: CallDirection; status?: CallStatus; outcome?: CallOutcome | null; scheduledAt?: string | null; durationSec?: number; notes?: string }) =>
    api.post<{ call: Call } & CallEffects>('/calls', data).then((r) => r.data),
  update: (id: string, data: { status?: CallStatus; outcome?: CallOutcome | null; scheduledAt?: string | null; durationSec?: number; notes?: string | null }) =>
    api.patch<{ call: Call } & CallEffects>(`/calls/${id}`, data).then((r) => r.data),
  summarize: (id: string) => api.post<{ call: Call; generatedBy: string }>(`/calls/${id}/summarize`).then((r) => r.data),
  remove: (id: string) => api.delete(`/calls/${id}`).then((r) => r.data),
};

// ============ Workflows (automation rules) ============

export type WorkflowTrigger =
  | 'REPLY_RECEIVED' | 'MEETING_BOOKED' | 'SEQUENCE_COMPLETED' | 'LEAD_UNSUBSCRIBED' | 'OPENED' | 'BOUNCED'
  | 'RECORD_COMMAND' | 'RECORD_CREATED' | 'RECORD_UPDATED' | 'ATTRIBUTE_UPDATED'
  | 'LIST_ENTRY_COMMAND' | 'RECORD_ADDED_TO_LIST' | 'LIST_ENTRY_UPDATED' | 'TASK_CREATED'
  | 'MANUAL_RUN' | 'RECURRING_SCHEDULE' | 'WEBHOOK_RECEIVED' | 'TYPEFORM_SUBMISSION' | 'OUTREACH_EVENT';
export type WorkflowConditionClass = 'INTERESTED' | 'NOT_INTERESTED' | 'FOLLOW_UP' | 'UNSUBSCRIBE' | null;

export interface Workflow {
  id: string;
  name: string;
  description: string | null;
  trigger: WorkflowTrigger;
  conditionClass: WorkflowConditionClass;
  actions: string[];
  isActive: boolean;
  isSystem: boolean;
  runCount: number;
  lastRunAt: string | null;
  createdAt: string;
  // M17-5 draft/published lifecycle
  publishedVersion?: number | null;
  published?: boolean;
  hasUnpublishedChanges?: boolean;
  draftUpdatedAt?: string | null;
}

export type WorkflowRunStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'PARTIAL' | 'FAILED' | 'SKIPPED';

export interface WorkflowRunItem {
  id: string;
  trigger: WorkflowTrigger;
  summary: string;
  createdAt: string;
  workflowName: string;
  workflowId?: string;
  lead: string | null;
  // M17-1: run-ledger поля (Runs-tab показывает реальные статусы/тайминг)
  status?: WorkflowRunStatus;
  durationMs?: number | null;
  attemptCount?: number;
  dedupeCount?: number;
  version?: number | null; // M17-5
}

// M17-1: детальный прогон + per-step ledger (для step-log drawer)
export interface WorkflowRunStepItem {
  id: string;
  order: number;
  action: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'SKIPPED';
  resultSummary: string | null;
  error: string | null;
  input: unknown;
  output: unknown;
  durationMs: number | null;
  attemptCount: number;
}

export interface WorkflowRunDetail {
  run: {
    id: string; workflowId: string; workflowName: string; trigger: WorkflowTrigger; status: WorkflowRunStatus;
    summary: string; error: string | null; startedAt: string | null; completedAt: string | null; durationMs: number | null;
    attemptCount: number; dedupeCount: number; idempotencyKey: string; campaignId: string | null; attributionMode: string | null;
    createdAt: string; lead: string | null; version?: number | null; // M17-5
  };
  steps: WorkflowRunStepItem[];
}

// M17-3: дескриптор параметра действия (фронт-билдер рендерит редактор по type).
export interface WorkflowActionParam {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'objectKey' | 'listId' | 'kv' | 'csv' | 'conditions' | 'cases' | 'match' | 'method' | 'transform';
  required?: boolean;
  placeholder?: string;
}
export interface WorkflowActionMeta {
  label: string;
  description: string;
  kind?: 'lead' | 'record' | 'list' | 'logic' | 'delay' | 'assign';
  mutating?: boolean;
  control?: boolean;
  params?: WorkflowActionParam[];
}
export interface WorkflowCatalog {
  triggers: Record<string, { label: string; description: string; supportsClass: boolean; delivery?: boolean }>;
  actions: Record<string, WorkflowActionMeta>;
}

export interface WorkflowsResponse {
  workflows: Workflow[];
  runs: WorkflowRunItem[];
  stats: { total: number; active: number; totalRuns: number };
  canManage: boolean;
  catalog: WorkflowCatalog;
}

export interface WorkflowInput {
  name: string;
  description?: string;
  trigger: WorkflowTrigger;
  conditionClass?: WorkflowConditionClass;
  actions: string[];
  isActive?: boolean;
}

export const workflowsApi = {
  list: () => api.get<WorkflowsResponse>('/workflows').then((r) => r.data),
  create: (data: WorkflowInput) => api.post<{ workflow: Workflow }>('/workflows', data).then((r) => r.data),
  update: (id: string, data: Partial<WorkflowInput>) => api.patch<{ workflow: Workflow }>(`/workflows/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete<{ ok: boolean }>(`/workflows/${id}`).then((r) => r.data),
  test: (id: string) => api.post<WorkflowTestResult>(`/workflows/${id}/test`, {}).then((r) => r.data),
  // M17-1: run-ledger
  runDetail: (runId: string) => api.get<WorkflowRunDetail>(`/workflows/runs/${runId}`).then((r) => r.data),
  retryRun: (runId: string) => api.post<{ ok: boolean; status?: string }>(`/workflows/runs/${runId}/retry`, {}).then((r) => r.data),
  rerun: (runId: string) => api.post<{ ok: boolean; runId?: string; status?: string }>(`/workflows/runs/${runId}/rerun`, {}).then((r) => r.data),
  runs: (workflowId: string, params?: { status?: string; limit?: number; offset?: number }) =>
    api.get<{ workflow: { id: string; name: string }; total: number; limit: number; offset: number; runs: WorkflowRunItem[] }>(`/workflows/${workflowId}/runs`, { params }).then((r) => r.data),
  // M17-2: ручной запуск правила (clientRequestId обязателен — защита от двойного клика)
  runManual: (workflowId: string, body: { clientRequestId: string; recordId?: string; objectId?: string; leadId?: string }) =>
    api.post<{ ok: boolean; runId?: string; status?: string; deduped?: boolean }>(`/workflows/${workflowId}/run`, body).then((r) => r.data),
  // M17-4: secret store (value наружу не отдаётся)
  listSecrets: () => api.get<{ available: boolean; canManage: boolean; secrets: WorkflowSecretMeta[] }>('/workflows/secrets').then((r) => r.data),
  setSecret: (key: string, value: string) => api.post<{ secret: WorkflowSecretMeta }>('/workflows/secrets', { key, value }).then((r) => r.data),
  deleteSecret: (key: string) => api.delete<{ ok: boolean; warning?: string }>(`/workflows/secrets/${encodeURIComponent(key)}`).then((r) => r.data),
  // M17-5: publish/draft lifecycle + duplicate
  publish: (id: string) => api.post<{ ok: boolean; version?: number; errors?: { index: number; field: string; message: string }[] }>(`/workflows/${id}/publish`, {}).then((r) => r.data),
  duplicate: (id: string) => api.post<{ workflow: Workflow }>(`/workflows/${id}/duplicate`, {}).then((r) => r.data),
};

export interface WorkflowSecretMeta { key: string; createdById: string | null; createdAt: string; updatedAt: string }

export interface WorkflowTestResult {
  ok: true;
  run: { id: string; summary: string; createdAt: string };
  lead: string | null;
  parts: string[];
  active: boolean;
}

// ============ Settings (workspace + mailboxes) ============

export interface Workspace {
  id: string;
  name: string;
  plan: string;
  leadsLimit: number;
  timezone: string;
  sendWindowStart: string;
  sendWindowEnd: string;
  sendDays: string[];
  dailySendLimit: number;
  // M14-5: автопилот авто-ответа.
  autoResponseEnabled: boolean;
  autoResponseMinConfidence: number;
  // M23-2: Workspace General
  logoUrl: string | null;
  companyDomain: string | null;
}

export type MailboxProvider = 'SMTP' | 'GMAIL' | 'OUTLOOK';
export type MailboxStatus = 'CONNECTED' | 'WARMING' | 'PAUSED' | 'ERROR';

export interface Mailbox {
  id: string;
  orgId: string;
  address: string;
  fromName: string | null;
  provider: MailboxProvider;
  status: MailboxStatus;
  dailyLimit: number;
  warmupDay: number;
  healthPct: number;
  isDefault: boolean;
  lastSyncAt: string | null;
  createdAt: string;
}

export interface MailboxSummary { total: number; healthy: number; warming: number; dailyCapacity: number }

export const settingsApi = {
  getWorkspace: () => api.get<{ workspace: Workspace; canManage: boolean }>('/settings/workspace').then((r) => r.data),
  updateWorkspace: (data: Partial<Pick<Workspace, 'name' | 'timezone' | 'sendWindowStart' | 'sendWindowEnd' | 'sendDays' | 'dailySendLimit' | 'autoResponseEnabled' | 'autoResponseMinConfidence' | 'logoUrl' | 'companyDomain'>>) =>
    api.patch<{ workspace: Workspace; canManage: boolean }>('/settings/workspace', data).then((r) => r.data),
  listMailboxes: () => api.get<{ mailboxes: Mailbox[]; summary: MailboxSummary; canManage: boolean }>('/settings/mailboxes').then((r) => r.data),
  connectMailbox: (data: { address: string; fromName?: string; provider?: MailboxProvider; dailyLimit?: number }) =>
    api.post<{ mailbox: Mailbox }>('/settings/mailboxes', data).then((r) => r.data),
  updateMailbox: (id: string, data: Partial<{ fromName: string | null; dailyLimit: number; status: MailboxStatus; isDefault: boolean }>) =>
    api.patch<{ mailbox: Mailbox }>(`/settings/mailboxes/${id}`, data).then((r) => r.data),
  removeMailbox: (id: string) => api.delete<{ ok: boolean }>(`/settings/mailboxes/${id}`).then((r) => r.data),
  integrations: () => api.get<{ integrations: IntegrationStatus[] }>('/settings/integrations').then((r) => r.data),
};

export interface IntegrationStatus { name: string; key: string; required: boolean; configured: boolean; purpose: string }

// ============ Learning insights ============

export interface InsightEvidence { label: string; value: string }

export interface LearningInsight {
  id: string;
  key: string; // стабильный ключ для ack-персистентности
  acknowledged: boolean; // отмечен ли «просмотрено» (из insight_acks)
  title: string;
  type: string;
  scope: string;
  conf: number;
  impact: string;
  status: 'Ready to promote' | 'Needs review' | 'Needs more data';
  learned: string;
  evidence: InsightEvidence[];
  validated: string;
  why: string;
  counter: string;
  rec: string;
}

export interface InsightsResponse {
  insights: LearningInsight[];
  generatedBy: 'deepseek' | 'anthropic' | 'demo';
  aggregates: {
    replies: { total: number; byClass: Record<string, number>; interestedRate: number };
    byIndustry: Array<{ industry: string; total: number; interested: number; rate: number }>;
    leads: { total: number; avgScore: number; avgScoreReplied: number };
    ai: { totalRuns: number; byType: Record<string, number> };
    campaigns: { total: number; active: number };
    enrolled: number;
  };
}

export const insightsApi = {
  get: () => api.get<InsightsResponse>('/insights').then((r) => r.data),
  ack: (key: string, acknowledged: boolean) =>
    api.post<{ key: string; acknowledged: boolean }>('/insights/ack', { key, acknowledged }).then((r) => r.data),
};

// ============ Ask AISDR (grounded-ассистент) ============
export interface AskCitation {
  label: string;
  value: string;
  href?: string;
}
export interface AskAction {
  kind: 'CREATE_TASK' | 'UPDATE_RECORD' | 'DRAFT_EMAIL' | 'NAVIGATE';
  label: string;
  rationale?: string;
  task?: { title: string; body?: string; leadId?: string; leadName?: string; recordId?: string };
  update?: { recordId: string; objectKey: string; objectName: string; attributeKey: string; attributeLabel: string; attributeType: string; value: unknown; currentDisplay: string; newDisplay: string };
  draft?: { leadId?: string; recordId?: string; toName?: string; toEmail?: string; subject: string; body: string };
  href?: string;
  id?: string; // id сохранённого pending-действия (для apply)
  status?: string;
}
// M26-2: результат apply действия
export interface AskApplyOutcome {
  applied: boolean;
  idempotent: boolean;
  kind: string;
  status: string;
  result: { type?: string; taskId?: string; draftId?: string; recordId?: string; attributeLabel?: string; newDisplay?: string; changed?: boolean; note?: string; sendable?: boolean; recordLinked?: boolean; href?: string } | null;
}
// M26-2: библиотека промптов
export interface SavedPrompt { id: string; title: string; body: string; scope: 'PERSONAL' | 'WORKSPACE'; updatedAt: string; canEdit: boolean }
export interface AskContextCounts {
  leads: number;
  replies: number;
  campaigns: number;
  meetings: number;
  tasks: number;
  records: number;
  creditsLeft: number;
}
export interface AskResponse {
  chatId: string;
  messageId: string;
  answer: string;
  citations: AskCitation[];
  action: AskAction | null;
  suggestions: string[];
  generatedBy: 'deepseek' | 'anthropic' | 'demo';
  context: AskContextCounts;
  webResearch?: boolean; // M26-2: live web-research подключён? (сейчас всегда false — честный бейдж)
}
export interface AskStarters {
  suggestions: string[];
  context: AskContextCounts;
}
// M26-1: треды
export interface AskChatListItem { id: string; title: string; updatedAt: string; preview: string }
export interface AskThreadMessage {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  citations: AskCitation[];
  generatedBy: string | null;
  createdAt: string;
  action: (AskAction & { id: string; status: string }) | null;
}
export interface AskChatDetail { id: string; title: string; messages: AskThreadMessage[] }
// M26-1: homepage S190
export interface AskHome {
  greeting: string;
  userName: string;
  meetings: Array<{ title: string; company: string; when: string | null }>;
  tasks: Array<{ id: string; title: string; dueAt: string | null; href: string }>;
  recentChats: Array<{ id: string; title: string; updatedAt: string }>;
  counts: AskContextCounts;
}
export const askApi = {
  starters: () => api.get<AskStarters>('/ask/starters').then((r) => r.data),
  ask: (question: string, chatId?: string) => api.post<AskResponse>('/ask', { question, chatId }).then((r) => r.data),
  chats: () => api.get<{ chats: AskChatListItem[] }>('/ask/chats').then((r) => r.data.chats),
  getChat: (id: string) => api.get<AskChatDetail>(`/ask/chats/${id}`).then((r) => r.data),
  deleteChat: (id: string) => api.delete(`/ask/chats/${id}`).then((r) => r.data),
  home: () => api.get<AskHome>('/ask/home').then((r) => r.data),
  // M26-2: apply сохранённого действия (idempotent по clientRequestId)
  applyAction: (id: string, clientRequestId: string) => api.post<AskApplyOutcome>(`/ask/actions/${id}/apply`, { clientRequestId }).then((r) => r.data),
  // M26-2: Prompt Library
  prompts: () => api.get<{ prompts: SavedPrompt[] }>('/ask/prompts').then((r) => r.data.prompts),
  createPrompt: (p: { title: string; body: string; scope: 'PERSONAL' | 'WORKSPACE' }) => api.post<{ id: string }>('/ask/prompts', p).then((r) => r.data),
  updatePrompt: (id: string, p: { title?: string; body?: string }) => api.patch(`/ask/prompts/${id}`, p).then((r) => r.data),
  deletePrompt: (id: string) => api.delete(`/ask/prompts/${id}`).then((r) => r.data),
};

// ============ Global Search (command palette) ============

export interface SearchHit { id: string; title: string; subtitle: string | null; meta: string | null; href: string }
export interface SearchGroup { type: string; label: string; icon: string; items: SearchHit[] }
export interface SearchResponse { query: string; groups: SearchGroup[]; total: number }

export const searchApi = {
  global: (q: string, limit?: number) =>
    api.get<SearchResponse>('/search', { params: { q, ...(limit ? { limit } : {}) } }).then((r) => r.data),
};

// ============ Playbooks strategy ============

export interface SpineSection {
  key: string;
  title: string;
  status: 'Complete' | 'Needs review' | 'In use';
  items: string[];
}

export interface StrategyResponse {
  spine: SpineSection[];
  generatedBy: 'deepseek' | 'anthropic' | 'demo';
}

export const playbooksApi = {
  strategy: (campaignId: string) =>
    api.get<StrategyResponse>(`/playbooks/${campaignId}/strategy`).then((r) => r.data),
};

// ============ Report Builder + Dashboards (модуль 14, M18-1) ============
// Конфигурируемые отчёты над CRM-объектами/списками (/dashboards). ОТДЕЛЬНО от analyticsApi
// (наша AI-SDR outbound-аналитика на /reports).

export type ReportType = 'INSIGHT' | 'FUNNEL' | 'HISTORICAL' | 'TIME_IN_STAGE' | 'STAGE_CHANGE';
export type ReportSourceType = 'OBJECT' | 'LIST';
export type ReportVisualization = 'BAR' | 'LINE' | 'TABLE' | 'FUNNEL';
export type ReportFilterOp = 'eq' | 'neq' | 'contains' | 'gt' | 'lt' | 'in' | 'is_empty' | 'is_not_empty';
export type ReportMetric = { kind: 'count' } | { kind: 'sum' | 'avg'; attributeId: string };
export interface ReportFilterInput { attributeKey: string; op: ReportFilterOp; value?: unknown }

export interface RbAttributeOption { value: string; label: string; order: number }
export interface RbAttribute { id: string; key: string; name: string; type: string; aiEnabled: boolean; options: RbAttributeOption[] }
export interface RbObject { id: string; key: string; singularName: string; pluralName: string; attributes: RbAttribute[] }
export interface RbList { id: string; name: string; primaryObjectId: string; primaryObjectKey: string | null; primaryObjectName: string | null }
export interface ReportBuilderMeta { objects: RbObject[]; lists: RbList[] }

export interface ReportRow {
  id: string; name: string; type: ReportType; sourceType: ReportSourceType;
  sourceObjectId: string | null; sourceListId: string | null;
  metric: ReportMetric; groupByAttributeId: string | null; segmentByAttributeId: string | null;
  filters: ReportFilterInput[]; visualization: ReportVisualization; config: { stageOrder?: string[]; dateRange?: { from?: string; to?: string } } | null;
  createdById: string | null; createdAt: string; updatedAt: string;
}

export interface ReportSegment { key: string; label: string; value: number | null }
export interface ReportBucket {
  key: string; label: string; value: number | null; records: number;
  segments?: ReportSegment[]; conversionFromFirst?: number | null; conversionFromPrevious?: number | null;
}
export interface ReportHistoryPoint { snapshotAt: string; buckets: { key: string; label: string; value: number | null }[] }
export interface ReportResult {
  type: ReportType; visualization: ReportVisualization; metricLabel: string;
  metricKind: 'count' | 'sum' | 'avg'; currencyCode: string | null; metricUnit?: string | null;
  groupByLabel: string | null; segmentByLabel: string | null;
  buckets: ReportBucket[]; segmentKeys: ReportSegment[]; history?: ReportHistoryPoint[]; totalRecords: number; warnings: string[];
}

export interface ReportDrillRecord { recordId: string; displayName: string; href: string; metricValue: number | null }
export interface ReportDrillResult { bucketKey: string; segmentKey: string | null; total: number; records: ReportDrillRecord[] }

export interface ReportConfigPayload {
  name: string; type: ReportType; sourceType: ReportSourceType;
  sourceObjectId?: string | null; sourceListId?: string | null;
  metric: ReportMetric; groupByAttributeId?: string | null; segmentByAttributeId?: string | null;
  filters: ReportFilterInput[]; visualization: ReportVisualization;
  config?: { stageOrder?: string[]; dateRange?: { from?: string; to?: string } } | null;
}

// ── Dashboards (M18-2) ──
export interface DashboardListItem { id: string; name: string; description: string | null; widgetCount: number; createdAt: string; updatedAt: string }
export interface DashboardWidgetItem { id: string; reportId: string | null; inline?: boolean; title?: string | null; reportType?: ReportType | null; x: number; y: number; w: number; h: number; order: number; report: ReportRow | null; result: ReportResult | null; missing: boolean; restricted?: boolean }
export interface DashboardDetail { dashboard: { id: string; name: string; description: string | null }; widgets: DashboardWidgetItem[] }

export const reportBuilderApi = {
  meta: () => api.get<ReportBuilderMeta>('/report-builder/meta').then((r) => r.data),
  list: () => api.get<{ reports: ReportRow[] }>('/report-builder/reports').then((r) => r.data.reports),
  get: (id: string) => api.get<{ report: ReportRow; result: ReportResult | null }>(`/report-builder/reports/${id}`).then((r) => r.data),
  preview: (cfg: ReportConfigPayload) => api.post<{ result: ReportResult }>('/report-builder/preview', cfg).then((r) => r.data.result),
  create: (cfg: ReportConfigPayload, clientRequestId?: string) =>
    api.post<{ report: ReportRow; result: ReportResult | null; deduped?: boolean }>('/report-builder/reports', { ...cfg, clientRequestId }).then((r) => r.data),
  update: (id: string, cfg: ReportConfigPayload) =>
    api.patch<{ report: ReportRow; result: ReportResult | null }>(`/report-builder/reports/${id}`, cfg).then((r) => r.data),
  remove: (id: string) => api.delete<{ ok: boolean }>(`/report-builder/reports/${id}`).then((r) => r.data),
  drill: (id: string, bucket: string, segment?: string | null) =>
    api.get<ReportDrillResult>(`/report-builder/reports/${id}/drill`, { params: { bucket, ...(segment ? { segment } : {}) } }).then((r) => r.data),
  backfillHistory: (id: string) => api.post<{ written: number; mode: string }>(`/report-builder/reports/${id}/backfill-history`, {}).then((r) => r.data),
};

export const dashboardsApi = {
  list: () => api.get<{ dashboards: DashboardListItem[] }>('/report-builder/dashboards').then((r) => r.data.dashboards),
  get: (id: string) => api.get<DashboardDetail>(`/report-builder/dashboards/${id}`).then((r) => r.data),
  create: (name: string, description?: string | null, clientRequestId?: string) => api.post<{ dashboard: DashboardListItem; deduped?: boolean }>('/report-builder/dashboards', { name, description, clientRequestId }).then((r) => r.data.dashboard),
  update: (id: string, name: string, description?: string | null) => api.patch(`/report-builder/dashboards/${id}`, { name, description }).then((r) => r.data),
  remove: (id: string) => api.delete<{ ok: boolean }>(`/report-builder/dashboards/${id}`).then((r) => r.data),
  addWidget: (dashboardId: string, reportId: string, clientRequestId?: string) => api.post(`/report-builder/dashboards/${dashboardId}/widgets`, { reportId, clientRequestId }).then((r) => r.data),
  // DSH-2: inline immutable снимок — отправляем reportConfig (тот же контракт, что saved report)
  addWidgetInline: (dashboardId: string, inlineConfig: ReportConfigPayload, clientRequestId?: string) => api.post(`/report-builder/dashboards/${dashboardId}/widgets`, { inlineConfig, clientRequestId }).then((r) => r.data),
  patchWidget: (dashboardId: string, widgetId: string, patch: { x?: number; y?: number; w?: number; h?: number; order?: number }) => api.patch(`/report-builder/dashboards/${dashboardId}/widgets/${widgetId}`, patch).then((r) => r.data),
  removeWidget: (dashboardId: string, widgetId: string) => api.delete<{ ok: boolean }>(`/report-builder/dashboards/${dashboardId}/widgets/${widgetId}`).then((r) => r.data),
  // DSH-3: drill-in из виджета (linked+inline) — реальные записи bucket/segment, тот же DrillResult, что у отчёта
  drillWidget: (dashboardId: string, widgetId: string, bucket: string, segment?: string | null) =>
    api.get<ReportDrillResult>(`/report-builder/dashboards/${dashboardId}/widgets/${widgetId}/drill`, { params: { bucket, ...(segment ? { segment } : {}) } }).then((r) => r.data),
};

// ============ Call Intelligence — insight templates (M19-1) ============
export type InsightOutputFormat = 'TEXT' | 'BULLETS';
export type InsightTemplateScope = 'PERSONAL' | 'WORKSPACE';
export interface InsightTemplateSection { id?: string; title: string; prompt: string; outputFormat: InsightOutputFormat; order: number }
export interface InsightTemplate {
  id: string; name: string; description: string | null; scope: InsightTemplateScope; ownerId: string | null;
  isSystem: boolean; version: number; editable: boolean; sections: InsightTemplateSection[]; createdAt: string; updatedAt: string;
}
export interface RunResultSection { sectionId: string; sectionTitle: string; order: number; outputFormat: InsightOutputFormat; content: string | string[] }
export interface CallInsightRun { id: string; callId: string; templateId: string; templateName: string; templateVersion: number; results: RunResultSection[]; creditsCharged: number; generatedBy: string; createdAt: string }
export interface InsightTemplatePayload { name: string; description?: string | null; scope: InsightTemplateScope; sections: { title: string; prompt: string; outputFormat: InsightOutputFormat; order?: number }[] }

// ── Call Intelligence — after-call артефакты + привязка + favorites (M19-2) ──
export interface CallChapter { id: string; title: string; startSec: number | null; order: number }
export interface CallSpeakerStat { speaker: string; talkSec: number; turns: number; sharePct: number }
export interface CallArtifacts {
  summary: string | null; chapters: CallChapter[]; speakerStats: CallSpeakerStat[]; speakerLabeled: boolean;
  info: { durationSec: number; provider: string; participants: number; date: string | null };
  finalizedAt: string | null; outdated: boolean; generatedBy: string;
}
export interface CallAssociatedRecord { id: string; objectKey: string; recordId: string; displayName: string | null; associationType: string }
export interface CallParticipantItem { id: string; name: string; email: string | null; recordId: string | null }
export interface CallArtifactsResponse { artifacts: CallArtifacts; associatedRecords: CallAssociatedRecord[]; participants: CallParticipantItem[]; favorite: boolean }

export const callArtifactsApi = {
  finalize: (callId: string) => api.post<{ artifacts: CallArtifacts }>(`/calls/${callId}/finalize`, {}).then((r) => r.data.artifacts),
  artifacts: (callId: string) => api.get<CallArtifactsResponse>(`/calls/${callId}/artifacts`).then((r) => r.data),
  addParticipant: (callId: string, name: string, email?: string) => api.post(`/calls/${callId}/participants`, { name, email }).then((r) => r.data),
  autoLink: (callId: string) => api.post<{ linked: number; pending: number; associatedRecords: CallAssociatedRecord[] }>(`/calls/${callId}/records`, { autoLink: true }).then((r) => r.data),
  linkRecord: (callId: string, recordId: string, objectKey: string) => api.post<{ associatedRecords: CallAssociatedRecord[] }>(`/calls/${callId}/records`, { recordId, objectKey }).then((r) => r.data),
  unlinkRecord: (callId: string, recordId: string, objectKey: string) => api.delete<{ ok: boolean; associatedRecords: CallAssociatedRecord[] }>(`/calls/${callId}/records/${recordId}`, { params: { objectKey } }).then((r) => r.data),
  setFavorite: (callId: string, on: boolean) => (on ? api.put(`/calls/${callId}/favorite`, {}) : api.delete(`/calls/${callId}/favorite`)).then((r) => r.data),
  byRecord: (recordId: string) => api.get<CallsResponse>('/calls', { params: { recordId } }).then((r) => r.data),
};

export const callInsightsApi = {
  templates: () => api.get<{ templates: InsightTemplate[] }>('/call-insight-templates').then((r) => r.data.templates),
  createTemplate: (body: InsightTemplatePayload) => api.post<{ template: InsightTemplate }>('/call-insight-templates', body).then((r) => r.data.template),
  updateTemplate: (id: string, body: InsightTemplatePayload) => api.patch<{ template: InsightTemplate }>(`/call-insight-templates/${id}`, body).then((r) => r.data.template),
  removeTemplate: (id: string) => api.delete<{ ok: boolean }>(`/call-insight-templates/${id}`).then((r) => r.data),
  setTranscript: (callId: string, transcript: string, source: 'upload' | 'paste' | 'demo' = 'paste') =>
    api.post<{ call: { id: string; transcript: string | null; transcriptSource: string | null } }>(`/calls/${callId}/transcript`, { transcript, source }).then((r) => r.data.call),
  run: (callId: string, templateId: string, opts?: { force?: boolean; clientRequestId?: string }) =>
    api.post<{ run: CallInsightRun; deduped: boolean; estimateCredits: number }>(`/calls/${callId}/insights/run`, { templateId, ...opts }).then((r) => r.data),
  runs: (callId: string) => api.get<{ runs: CallInsightRun[] }>(`/calls/${callId}/insights`).then((r) => r.data.runs),
};

// ============ Import / Migration — job-flow (M20-1) ============
export type ImportJobStatus = 'UPLOADED' | 'MAPPING_REQUIRED' | 'READY' | 'RUNNING' | 'COMPLETED' | 'COMPLETED_WITH_ERRORS' | 'FAILED' | 'CANCELED';
export interface RollbackStats { reverted: number; skippedManual: number; archived: number; valuesDeleted: number; listEntriesDeleted: number; errors: number }
export interface ImportJobSummary {
  id: string; fileName: string; targetType: 'OBJECT' | 'LIST'; objectId: string | null; listId: string | null; status: ImportJobStatus;
  rowCount: number; createdCount: number; updatedCount: number; skippedCount: number; errorCount: number; processedRows: number;
  dedupeKey: string | null; createdById: string | null; createdAt: string; completedAt: string | null;
  rolledBackAt: string | null; rollbackStats: RollbackStats | null;
}
export interface RollbackPreview {
  recordsToArchive: number; recordsSkippedManual: number; valuesToRevert: number; valuesSkippedManual: number;
  listEntriesToDelete: number; alreadyRolledBack: boolean;
  details: { type: 'create' | 'update' | 'listEntry'; recordId?: string; attributeKey?: string; action: string }[];
}
export interface ImportMappingEntry { attributeKey: string; asRelationship?: boolean; requiredStrategy?: 'error' | 'skip' | 'leave' }
export type ImportMapping = Record<string, ImportMappingEntry>;
export interface ImportRowPlan { row: number; action: 'create' | 'update' | 'skip' | 'error'; recordId: string | null; values: Record<string, unknown>; listValues?: Record<string, unknown>; errors: string[]; warnings: string[] }
export interface ImportPreview { estimate: { created: number; updated: number; skipped: number; errors: number }; detectedTypes: Record<string, string>; warnings: string[]; rows: ImportRowPlan[]; totalRows?: number }
export interface ImportRowResult { row: number; action: string; recordId?: string | null; errors?: string[]; warnings?: string[] }
export interface ImportCreateResponse { job: ImportJobSummary; headers: string[]; sampleRows: Record<string, string>[]; mapping: ImportMapping; deduped?: boolean }
export interface ImportDetail { job: ImportJobSummary; headers: string[]; sampleRows: Record<string, string>[]; mapping: ImportMapping; rowResults: ImportRowResult[] | null; preview: ImportPreview | null }

export const importsApi = {
  create: (body: { targetType?: 'OBJECT' | 'LIST'; objectKey?: string; objectId?: string; listId?: string; fileName: string; delimiter?: string; headers: string[]; rows: Record<string, string>[]; clientRequestId?: string }) =>
    api.post<ImportCreateResponse>('/imports', body).then((r) => r.data),
  list: (objectId?: string) => api.get<{ imports: ImportJobSummary[] }>('/imports', { params: objectId ? { objectId } : {} }).then((r) => r.data.imports),
  get: (id: string) => api.get<ImportDetail>(`/imports/${id}`).then((r) => r.data),
  saveMapping: (id: string, mapping: ImportMapping, dedupeKey?: string | null) => api.patch<{ job: ImportJobSummary; mapping: ImportMapping }>(`/imports/${id}/mapping`, { mapping, dedupeKey }).then((r) => r.data),
  preview: (id: string, body: { mapping?: ImportMapping; dedupeKey?: string | null }) => api.post<ImportPreview>(`/imports/${id}/preview`, body).then((r) => r.data),
  confirm: (id: string) => api.post<{ result: { created: number; updated: number; skipped: number; errorCount: number; status: ImportJobStatus; entriesCreated?: number; entriesExisting?: number; listValuesWritten?: number } }>(`/imports/${id}/confirm`, {}).then((r) => r.data.result),
  cancel: (id: string) => api.post<{ ok: boolean }>(`/imports/${id}/cancel`, {}).then((r) => r.data),
  rollbackPreview: (id: string, force = false) => api.post<{ preview: RollbackPreview }>(`/imports/${id}/rollback/preview`, { force }).then((r) => r.data.preview),
  rollback: (id: string, force = false) => api.post<{ stats: RollbackStats }>(`/imports/${id}/rollback`, { force }).then((r) => r.data.stats),
};

// ============ Permissions / RBAC (M21-1) ============
export type AccessLevel = 'NONE' | 'READ' | 'READ_WRITE' | 'FULL';
export type PermissionScope = 'WORKSPACE' | 'TEAM' | 'INDIVIDUAL';
export type EntityKind = 'OBJECT' | 'LIST' | 'DASHBOARD' | 'WORKFLOW' | 'SEQUENCE';
export interface PermissionGrantRow { scope: PermissionScope; subjectKey: string; entityKind: EntityKind; entityKey: string; level: AccessLevel }
export interface TeamSummary { id: string; name: string; isExternal: boolean; subjectKey: string; memberIds: string[]; description?: string | null; color?: string | null }
export interface OrgUser { id: string; name: string; email: string; role: string }
export interface AutomationGrantRow { workflowId: string; entityKind: EntityKind; entityKey: string; level: AccessLevel }
export interface PermissionMatrix {
  kinds: EntityKind[];
  workspaceDefaults: Record<string, AccessLevel>;
  grants: PermissionGrantRow[];
  entities: Record<string, { id: string; name: string }[]>;
  teams: TeamSummary[];
  users: OrgUser[];
  automationGrants: AutomationGrantRow[];
}

export const permissionsApi = {
  matrix: () => api.get<PermissionMatrix>('/permissions').then((r) => r.data),
  setGrant: (g: { scope: PermissionScope; subjectKey: string; entityKind: EntityKind; entityKey: string; level: AccessLevel }) =>
    api.put<{ ok: boolean }>('/permissions/grant', g).then((r) => r.data),
  clearGrant: (g: { scope: PermissionScope; subjectKey: string; entityKind: EntityKind; entityKey: string }) =>
    api.delete<{ ok: boolean }>('/permissions/grant', { data: g }).then((r) => r.data),
  setAutomation: (g: { workflowId: string; entityKind: EntityKind; entityKey: string; level: 'READ' | 'READ_WRITE' }) =>
    api.put<{ ok: boolean }>('/permissions/automation', g).then((r) => r.data),
  clearAutomation: (g: { workflowId: string; entityKind: EntityKind; entityKey: string }) =>
    api.delete<{ ok: boolean }>('/permissions/automation', { data: g }).then((r) => r.data),
};

export const teamsApi = {
  list: () => api.get<{ teams: TeamSummary[]; users: OrgUser[] }>('/teams').then((r) => r.data),
  create: (b: { name: string; description?: string; color?: string; isExternal?: boolean }) => api.post<{ team: TeamSummary }>('/teams', b).then((r) => r.data.team),
  update: (id: string, b: { name?: string; isExternal?: boolean; color?: string; description?: string }) => api.patch<{ team: TeamSummary }>(`/teams/${id}`, b).then((r) => r.data.team),
  remove: (id: string) => api.delete<{ ok: boolean }>(`/teams/${id}`).then((r) => r.data),
  addMembers: (id: string, userIds: string[]) => api.post<{ added: number }>(`/teams/${id}/members`, { userIds }).then((r) => r.data),
  removeMember: (id: string, userId: string) => api.delete<{ ok: boolean }>(`/teams/${id}/members/${userId}`).then((r) => r.data),
};

export default api;
