// ============ Enums ============

export type Role = 'OWNER' | 'ADMIN' | 'MEMBER';
export type Plan = 'STARTER' | 'GROWTH' | 'AGENCY';
export type LeadStatus = 'NEW' | 'CONTACTED' | 'REPLIED' | 'HOT' | 'CONVERTED' | 'LOST' | 'UNSUBSCRIBED';
export type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';
export type Channel = 'EMAIL' | 'LINKEDIN';
export type Direction = 'OUTBOUND' | 'INBOUND';
export type ReplyClass = 'INTERESTED' | 'NOT_INTERESTED' | 'FOLLOW_UP' | 'UNSUBSCRIBE';

// ============ Core Models ============

export interface Organization {
  id: string;
  name: string;
  plan: Plan;
  leadsLimit: number;
  stripeCustomerId?: string | null;
  stripeSubId?: string | null;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  orgId: string | null;
  org: Organization | null;
}

export interface Lead {
  id: string;
  orgId: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  linkedinUrl?: string | null;
  title?: string | null;
  company?: string | null;
  companySize?: string | null;
  industry?: string | null;
  country?: string | null;
  city?: string | null;
  website?: string | null;
  score: number;
  status: LeadStatus;
  source?: string | null;
  apolloId?: string | null;
  enriched: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Campaign {
  id: string;
  orgId: string;
  userId: string;
  name: string;
  status: CampaignStatus;
  channel: Channel;
  targetIndustry?: string | null;
  targetCountry?: string | null;
  targetSize?: string | null;
  dailyLimit: number;
  createdAt: string;
  updatedAt: string;
  _count?: {
    campaignLeads: number;
    sequences: number;
  };
  user?: {
    name: string;
    email: string;
  };
  sequences?: Sequence[];
}

export interface Sequence {
  id: string;
  campaignId: string;
  stepNumber: number;
  delayDays: number;
  subject?: string | null;
  body: string;
  channel: Channel;
  createdAt: string;
}

export interface Message {
  id: string;
  leadId: string;
  direction: Direction;
  channel: Channel;
  subject?: string | null;
  body: string;
  aiGenerated: boolean;
  replyClass?: ReplyClass | null;
  sentAt?: string | null;
  openedAt?: string | null;
  repliedAt?: string | null;
  createdAt: string;
}

// ============ API Response Types ============

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LeadsResponse {
  leads: Lead[];
  total: number;
  page: number;
  pages: number;
}

export interface AnalyticsStats {
  totalLeads: number;
  activeCampaigns: number;
  emailsSentThisWeek: number;
  replyRate: number;
  openRate: number;
  hotLeads: Lead[];
  recentActivity: ActivityItem[];
  leadsByStatus: Record<string, number>;
  dailyChart?: Array<{ date: string; sent: number; replies: number }>;
}

export interface ActivityItem {
  id: string;
  leadName: string;
  company?: string | null;
  direction: Direction;
  channel: Channel;
  subject?: string | null;
  replyClass?: ReplyClass | null;
  createdAt: string;
}

export interface GeneratedOutreach {
  subject: string;
  body: string;
  channel: Channel;
  messageId?: string;
}

export interface CampaignStats {
  campaign: {
    id: string;
    name: string;
    status: CampaignStatus;
    channel: Channel;
    createdAt: string;
  };
  totalEnrolled: number;
  statusBreakdown: Record<string, number>;
  totalMessages: number;
  openRate: number;
  replyRate: number;
}

// ============ Form Types ============

export interface LoginForm {
  email: string;
  password: string;
}

export interface RegisterForm {
  email: string;
  password: string;
  name: string;
  orgName: string;
  referralCode?: string;
}

export interface CreateLeadForm {
  firstName: string;
  lastName: string;
  email?: string;
  linkedinUrl?: string;
  title?: string;
  company?: string;
  industry?: string;
  country?: string;
  notes?: string;
}

export interface CreateCampaignForm {
  name: string;
  channel: Channel;
  targetIndustry?: string;
  targetCountry?: string;
  targetSize?: string;
  dailyLimit: number;
}

export interface GenerateOutreachForm {
  leadId?: string;
  campaignId?: string;
  language: 'en' | 'ru' | 'de';
  tone: 'professional' | 'casual' | 'friendly';
  senderName?: string;
  senderTitle?: string;
  senderCompany?: string;
  valueProposition?: string;
}
