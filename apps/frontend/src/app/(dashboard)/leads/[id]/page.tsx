'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Sidebar as SidebarIcon, X } from 'lucide-react';
import { leadsApi } from '@/lib/api';
import Topbar from '@/components/layout/Topbar';
import { useToast } from '@/components/ui/Toast';
import Skeleton, { SkeletonText } from '@/components/ui/Skeleton';
import LeadHeader from '@/components/leads/LeadHeader';
import LeadTabs, { type LeadTabId } from '@/components/leads/LeadTabs';
import ActivityFeed from '@/components/leads/ActivityFeed';
import EmailsTab from '@/components/leads/EmailsTab';
import NotesTab from '@/components/leads/NotesTab';
import CallsTab from '@/components/leads/CallsTab';
import TasksTab from '@/components/leads/TasksTab';
import FilesTab from '@/components/leads/FilesTab';
import RightPanel from '@/components/leads/RightPanel';
import type { Lead, Message } from '@/types';

interface CampaignLead {
  campaign: { id: string; name: string; status: string };
  currentStep: number;
  status: string;
  nextSendAt: string | null;
  createdAt?: string;
}

interface LeadDetail extends Lead {
  messages: Message[];
  campaignLeads: CampaignLead[];
}

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();

  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<LeadTabId>('activity');
  const [panelOpen, setPanelOpen] = useState(false); // mobile drawer

  const fetchLead = useCallback(async () => {
    try {
      const data = await leadsApi.get(id);
      setLead(data as unknown as LeadDetail);
    } catch (err: unknown) {
      const err_ = err as { response?: { status?: number } };
      if (err_?.response?.status === 404) {
        toast.error('Lead not found');
      } else {
        toast.error('Failed to load lead');
      }
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => { void fetchLead(); }, [fetchLead]);

  const fullName = lead ? `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim() || 'Lead' : 'Lead';

  const counts: Partial<Record<LeadTabId, number>> = {
    emails: (lead?.messages ?? []).filter((m) => m.channel === 'EMAIL').length,
    notes: lead?.notes ? lead.notes.split(/\n{2,}/).filter((s) => s.trim()).length : 0,
    calls: 0,
    tasks: 0,
    files: 0,
  };

  if (loading) {
    return (
      <>
        <Topbar
          icon={<SidebarIcon size={14} strokeWidth={1.75} />}
          title="Leads"
          subtitle="Loading…"
        />
        <div className="flex h-[calc(100vh-44px)]">
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="h-16 px-6 flex items-center gap-4 border-b border-[var(--border)] bg-white">
              <Skeleton className="w-10 h-10" rounded="full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
            <div className="h-10 border-b border-[var(--border)] bg-white" />
            <div className="p-6 space-y-3 max-w-2xl">
              <SkeletonText lines={6} />
            </div>
          </div>
          <aside className="w-80 shrink-0 border-l border-[var(--border)] bg-white p-4 space-y-3">
            <SkeletonText lines={8} />
          </aside>
        </div>
      </>
    );
  }

  if (!lead) {
    return (
      <>
        <Topbar title="Leads" subtitle="Not found" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-[16px] font-semibold text-[var(--text)]">Lead not found</h2>
            <p className="text-[13.5px] text-[var(--text-muted)] mt-1">
              It may have been deleted or you don&apos;t have access.
            </p>
            <button
              onClick={() => router.push('/leads')}
              className="mt-4 text-[13px] text-[var(--brand)] hover:underline"
            >
              ← Back to leads
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar
        icon={
          <button
            type="button"
            onClick={() => router.push('/leads')}
            aria-label="Back to leads"
            className="w-6 h-6 inline-flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors duration-100"
          >
            <ChevronLeft size={14} strokeWidth={1.75} />
          </button>
        }
        title="Leads"
        subtitle={fullName}
        actions={
          <button
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
            className="md:hidden inline-flex items-center gap-1 h-7 px-2 rounded-md text-[12.5px] font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors duration-100"
          >
            Details
          </button>
        }
      />

      <div className="flex h-[calc(100vh-44px)] relative">
        {/* Left: details */}
        <div className="flex-1 min-w-0 flex flex-col bg-white">
          <LeadHeader
            lead={lead}
            onCompose={() => toast.info('Compose email coming soon')}
            onAddToCampaign={() => toast.info('Campaign picker coming soon')}
          />

          <LeadTabs value={tab} onChange={setTab} counts={counts} />

          <div className="flex-1 overflow-y-auto">
            {tab === 'activity' && (
              <ActivityFeed
                lead={lead}
                messages={lead.messages}
                campaignLeads={lead.campaignLeads}
              />
            )}
            {tab === 'emails' && (
              <EmailsTab lead={lead} messages={lead.messages} onChanged={fetchLead} />
            )}
            {tab === 'calls' && <CallsTab />}
            {tab === 'notes' && (
              <NotesTab lead={lead} onChanged={(updated) => setLead({ ...lead, ...updated })} />
            )}
            {tab === 'tasks' && <TasksTab />}
            {tab === 'files' && <FilesTab />}
          </div>
        </div>

        {/* Right panel: desktop */}
        <div className="hidden md:block">
          <RightPanel lead={lead} className="h-full" />
        </div>

        {/* Right panel: mobile drawer */}
        {panelOpen && (
          <div className="md:hidden fixed inset-0 z-40">
            <div
              className="absolute inset-0 bg-[#0f0f0e]/40"
              onClick={() => setPanelOpen(false)}
            />
            <div className="absolute right-0 top-0 bottom-0 w-80 bg-white shadow-lg flex flex-col">
              <div className="h-10 px-4 flex items-center justify-between border-b border-[var(--border)]">
                <span className="text-[13.5px] font-semibold text-[var(--text)]">Details</span>
                <button
                  type="button"
                  onClick={() => setPanelOpen(false)}
                  aria-label="Close"
                  className="w-7 h-7 rounded-md inline-flex items-center justify-center text-[var(--text-subtle)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors duration-100"
                >
                  <X size={14} strokeWidth={1.75} />
                </button>
              </div>
              <RightPanel lead={lead} className="flex-1 border-l-0" />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
