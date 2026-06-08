'use client';

import { useMemo, useState } from 'react';
import { ChevronRight, Mail, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
import Avatar from '@/components/ui/Avatar';
import type { Lead, Message } from '@/types';
import AutoReplyAction from './AutoReplyAction';

interface EmailsTabProps {
  lead: Lead;
  messages: Message[];
  onChanged?: () => void;
}

function looksLikeHtml(s: string): boolean {
  if (!s) return false;
  return /<\/?(p|div|br|span|a|strong|em|b|i|h[1-6]|ul|ol|li|table|tr|td|img|html|body)\b/i.test(s);
}

function senderLabel(msg: Message): string {
  return msg.direction === 'OUTBOUND' ? 'you' : 'recipient';
}

function EmailRow({
  message,
  lead,
  open,
  onToggle,
  onChanged,
}: {
  message: Message;
  lead: Lead;
  open: boolean;
  onToggle: () => void;
  onChanged?: () => void;
}) {
  const when = message.sentAt ?? message.createdAt;
  const dt = when ? format(new Date(when), 'MMM d, h:mm a') : '';
  const isHtml = looksLikeHtml(message.body);
  const isInbound = message.direction === 'INBOUND';
  const isInterested = isInbound && message.replyClass === 'INTERESTED';

  const initials = isInbound
    ? `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim() || 'Lead'
    : 'You';

  return (
    <li className="border-b border-[var(--border)] last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className={clsx(
          'w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors duration-100',
          open ? 'bg-[var(--surface-2)]' : 'hover:bg-[var(--surface-2)]',
        )}
      >
        <ChevronRight
          size={12}
          strokeWidth={2}
          className={clsx(
            'text-[var(--text-subtle)] shrink-0 transition-transform duration-100',
            open && 'rotate-90',
          )}
        />
        <Avatar name={initials} size={24} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[13.5px] font-medium text-[var(--text)] truncate">
              {message.subject || '(no subject)'}
            </span>
            {message.aiGenerated && (
              <span
                className="inline-flex items-center gap-0.5 h-4 px-1 rounded-sm text-[10px] font-medium uppercase tracking-[0.04em] leading-none shrink-0"
                style={{ backgroundColor: 'var(--brand-soft)', color: 'var(--brand)' }}
              >
                <Sparkles size={9} strokeWidth={2} />
                AI
              </span>
            )}
            {isInterested && (
              <span
                className="inline-flex items-center h-4 px-1 rounded-sm text-[10px] font-medium uppercase tracking-[0.04em] leading-none shrink-0"
                style={{ backgroundColor: 'var(--success-soft)', color: 'var(--success)' }}
              >
                Interested
              </span>
            )}
          </div>
          <p className="text-[12px] text-[var(--text-subtle)] mt-0.5 truncate">
            {lead.email ?? 'no email'}
            {', '}
            <span className="text-[var(--text-muted)]">{senderLabel(message)}</span>
            {message.openedAt && (
              <span className="ml-2 text-[var(--success)]">· Opened</span>
            )}
          </p>
        </div>
        <span className="text-[12px] text-[var(--text-subtle)] tabular-nums shrink-0">
          {dt}
        </span>
      </button>

      {open && (
        <div className="px-12 pb-4 pt-1">
          {isHtml ? (
            <div
              className="text-[13.5px] text-[var(--text)] leading-relaxed"
              // Trust backend HTML — this is the user's own outbound email content.
              dangerouslySetInnerHTML={{ __html: message.body }}
            />
          ) : (
            <p className="text-[13.5px] text-[var(--text)] leading-relaxed whitespace-pre-wrap">
              {message.body}
            </p>
          )}

          {isInterested && (
            <AutoReplyAction message={message} onSent={onChanged} />
          )}
        </div>
      )}
    </li>
  );
}

export default function EmailsTab({ lead, messages, onChanged }: EmailsTabProps) {
  const emails = useMemo(
    () =>
      messages
        .filter((m) => m.channel === 'EMAIL')
        .sort((a, b) => {
          const ta = new Date(a.sentAt ?? a.createdAt).getTime();
          const tb = new Date(b.sentAt ?? b.createdAt).getTime();
          return tb - ta;
        }),
    [messages],
  );

  const [openId, setOpenId] = useState<string | null>(emails[0]?.id ?? null);

  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-16 px-6">
        <span className="w-14 h-14 rounded-full bg-[var(--surface-2)] inline-flex items-center justify-center text-[var(--text-subtle)] mb-3">
          <Mail size={24} strokeWidth={1.75} />
        </span>
        <h2 className="text-[16px] font-semibold text-[var(--text)]">No emails yet</h2>
        <p className="text-[13.5px] text-[var(--text-muted)] mt-1 max-w-[320px]">
          Send your first outreach email and the entire thread will live here.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-[var(--border)]">
      {emails.map((m) => (
        <EmailRow
          key={m.id}
          message={m}
          lead={lead}
          open={openId === m.id}
          onToggle={() => setOpenId((id) => (id === m.id ? null : m.id))}
          onChanged={onChanged}
        />
      ))}
    </ul>
  );
}
