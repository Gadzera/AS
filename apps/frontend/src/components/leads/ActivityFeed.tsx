'use client';

import {
  Activity as ActivityIcon,
  Edit3,
  Mail,
  MessageSquare,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import {
  differenceInCalendarDays,
  format,
  formatDistanceToNowStrict,
  isThisWeek,
  isToday,
  isYesterday,
} from 'date-fns';
import { useMemo } from 'react';
import Avatar from '@/components/ui/Avatar';
import type { Lead, Message } from '@/types';

type EventKind = 'email_sent' | 'email_reply' | 'campaign_enroll' | 'created' | 'enriched';

interface FeedEvent {
  id: string;
  kind: EventKind;
  at: string;          // ISO
  actor: string;       // displayed name
  verb: string;        // e.g. "sent email", "replied"
  subject?: string;    // optional inline card title
  preview?: string;    // optional inline card body
  iconColor?: string;  // optional tag for the marker
}

interface CampaignLead {
  campaign: { id: string; name: string; status: string };
  currentStep: number;
  status: string;
  nextSendAt: string | null;
  createdAt?: string;
}

interface ActivityFeedProps {
  lead: Lead;
  messages: Message[];
  campaignLeads: CampaignLead[];
}

const ICON_MAP: Record<EventKind, typeof Mail> = {
  email_sent: Mail,
  email_reply: MessageSquare,
  campaign_enroll: UserPlus,
  created: Edit3,
  enriched: Sparkles,
};

function truncate(s: string, n = 180): string {
  if (!s) return '';
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + '…';
}

function dateBucketKey(d: Date, now: Date): { key: string; label: string; order: number } {
  if (isToday(d)) return { key: 'today', label: 'Today', order: 0 };
  if (isYesterday(d)) return { key: 'yesterday', label: 'Yesterday', order: 1 };
  if (isThisWeek(d, { weekStartsOn: 1 })) return { key: 'this-week', label: 'This week', order: 2 };
  const days = differenceInCalendarDays(now, d);
  if (days <= 30) return { key: 'this-month', label: 'This month', order: 3 };
  // older — group by month/year
  const key = format(d, 'yyyy-MM');
  return { key, label: format(d, 'MMMM yyyy'), order: 10 + (now.getFullYear() * 12 + now.getMonth() - (d.getFullYear() * 12 + d.getMonth())) };
}

function buildEvents(lead: Lead, messages: Message[], campaignLeads: CampaignLead[]): FeedEvent[] {
  const events: FeedEvent[] = [];

  // Lead creation
  if (lead.createdAt) {
    events.push({
      id: `lead-created-${lead.id}`,
      kind: 'created',
      at: lead.createdAt,
      actor: 'System',
      verb: 'added this lead',
      preview: lead.source
        ? `Imported via ${lead.source}`
        : 'Lead record was created',
    });
  }

  // Enrichment (mock signal — only if enriched flag is true)
  if (lead.enriched && lead.updatedAt && lead.updatedAt !== lead.createdAt) {
    events.push({
      id: `lead-enriched-${lead.id}`,
      kind: 'enriched',
      at: lead.updatedAt,
      actor: 'System',
      verb: 'enriched record with firmographic data',
      preview: [lead.industry, lead.companySize ? `${lead.companySize} employees` : null, lead.country]
        .filter(Boolean)
        .join(' · ') || undefined,
    });
  }

  // Campaign enrollments
  for (const cl of campaignLeads) {
    if (cl.createdAt) {
      events.push({
        id: `cl-${cl.campaign.id}`,
        kind: 'campaign_enroll',
        at: cl.createdAt,
        actor: 'System',
        verb: 'enrolled in campaign',
        subject: cl.campaign.name,
        preview: `Step ${cl.currentStep + 1} · ${cl.status}`,
      });
    }
  }

  // Messages
  for (const m of messages) {
    const at = m.sentAt ?? m.createdAt;
    if (m.direction === 'OUTBOUND') {
      events.push({
        id: `msg-${m.id}`,
        kind: 'email_sent',
        at,
        actor: m.aiGenerated ? 'AI' : 'You',
        verb: m.aiGenerated ? 'sent an AI-personalized email' : 'sent an email',
        subject: m.subject || undefined,
        preview: m.body ? truncate(m.body, 220) : undefined,
      });
      if (m.openedAt) {
        events.push({
          id: `msg-open-${m.id}`,
          kind: 'email_sent',
          at: m.openedAt,
          actor: 'Recipient',
          verb: 'opened the email',
          subject: m.subject || undefined,
        });
      }
    } else {
      events.push({
        id: `msg-${m.id}`,
        kind: 'email_reply',
        at,
        actor: 'Recipient',
        verb: m.replyClass === 'INTERESTED' ? 'replied (interested)' : 'replied',
        subject: m.subject || undefined,
        preview: m.body ? truncate(m.body, 220) : undefined,
      });
    }
  }

  // sort desc
  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return events;
}

function groupByDate(events: FeedEvent[]): { key: string; label: string; events: FeedEvent[] }[] {
  const now = new Date();
  const map = new Map<string, { label: string; order: number; events: FeedEvent[] }>();
  for (const e of events) {
    const d = new Date(e.at);
    if (Number.isNaN(d.getTime())) continue;
    const b = dateBucketKey(d, now);
    if (!map.has(b.key)) map.set(b.key, { label: b.label, order: b.order, events: [] });
    map.get(b.key)!.events.push(e);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[1].order - b[1].order)
    .map(([key, v]) => ({ key, label: v.label, events: v.events }));
}

function EventRow({ event, isLast }: { event: FeedEvent; isLast: boolean }) {
  const Icon = ICON_MAP[event.kind] ?? Edit3;
  const when = useMemo(() => {
    try {
      return formatDistanceToNowStrict(new Date(event.at), { addSuffix: true });
    } catch {
      return '';
    }
  }, [event.at]);

  return (
    <div className="flex">
      {/* Timeline column */}
      <div className="w-10 shrink-0 relative flex justify-center">
        <span
          className="absolute top-2.5 z-10 inline-flex items-center justify-center w-4 h-4 rounded-full bg-[var(--surface-3)] text-[var(--text-muted)]"
        >
          <Icon size={10} strokeWidth={2} />
        </span>
        {!isLast && (
          <span className="absolute top-2.5 left-1/2 -translate-x-1/2 w-px bg-[var(--border)] h-full" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 py-2 px-3">
        <div className="flex items-start gap-2">
          <Avatar name={event.actor} size={20} />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[13.5px] font-medium text-[var(--text)] truncate">
                {event.actor}
              </span>
              <span className="text-[13.5px] text-[var(--text-muted)] truncate">
                {event.verb}
              </span>
            </div>
            {(event.subject || event.preview) && (
              <div className="mt-1.5 bg-[var(--surface-2)] rounded-md px-3 py-2 text-[13px] text-[var(--text)] max-w-2xl">
                {event.subject && (
                  <p className="font-medium leading-snug truncate">{event.subject}</p>
                )}
                {event.preview && (
                  <p className="text-[var(--text-muted)] leading-snug line-clamp-2 mt-0.5 whitespace-pre-wrap">
                    {event.preview}
                  </p>
                )}
              </div>
            )}
          </div>
          <span className="text-[12px] text-[var(--text-subtle)] tabular-nums whitespace-nowrap shrink-0">
            {when}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ActivityFeed({ lead, messages, campaignLeads }: ActivityFeedProps) {
  const groups = useMemo(
    () => groupByDate(buildEvents(lead, messages, campaignLeads)),
    [lead, messages, campaignLeads],
  );

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-16 px-6">
        <span className="w-14 h-14 rounded-full bg-[var(--surface-2)] inline-flex items-center justify-center text-[var(--text-subtle)] mb-3">
          <ActivityIcon size={24} strokeWidth={1.75} />
        </span>
        <h2 className="text-[16px] font-semibold text-[var(--text)]">No activity yet</h2>
        <p className="text-[13.5px] text-[var(--text-muted)] mt-1 max-w-[320px]">
          Activity will show up here when you interact with this lead.
        </p>
      </div>
    );
  }

  return (
    <div className="pb-12">
      {groups.map((g) => (
        <section key={g.key}>
          <h3 className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-subtle)] font-semibold py-3 px-6 sticky top-10 bg-white z-[5]">
            {g.label}
          </h3>
          <div className="px-3">
            {g.events.map((e, i) => (
              <EventRow key={e.id} event={e} isLast={i === g.events.length - 1} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
