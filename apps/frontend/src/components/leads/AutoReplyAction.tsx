'use client';

import { useState } from 'react';
import { Sparkles, Send, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import { outreachApi } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import type { Message } from '@/types';

interface AutoReplyActionProps {
  message: Message;
  onSent?: () => void;
}

export default function AutoReplyAction({ message, onSent }: AutoReplyActionProps) {
  const toast = useToast();
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null);
  const [editing, setEditing] = useState(false);

  async function generate() {
    setGenerating(true);
    try {
      const res = await outreachApi.autoReply({
        messageId: message.id,
        replyText: message.body,
        language: 'en',
        send: false,
      });
      setDraft(res);
    } catch (err: unknown) {
      const err_ = err as { response?: { data?: { error?: string } } };
      const msg = err_?.response?.data?.error || '';
      if (msg.toLowerCase().includes('anthropic') || msg.toLowerCase().includes('api key')) {
        toast.error('AI key not configured', 'Set ANTHROPIC_API_KEY in the backend to enable auto-replies.');
      } else {
        toast.error('Could not generate follow-up', msg || 'Unknown error');
      }
    } finally {
      setGenerating(false);
    }
  }

  async function send() {
    if (!draft) return;
    setSending(true);
    try {
      await outreachApi.autoReply({
        messageId: message.id,
        replyText: message.body,
        language: 'en',
        send: true,
      });
      toast.success('Follow-up sent');
      setDraft(null);
      onSent?.();
    } catch (err: unknown) {
      const err_ = err as { response?: { data?: { error?: string } } };
      toast.error('Failed to send', err_?.response?.data?.error || 'Try again later');
    } finally {
      setSending(false);
    }
  }

  if (!draft) {
    return (
      <div className="mt-2 rounded-md border border-[var(--border)] bg-[var(--success-soft)]/40 px-3 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles size={14} strokeWidth={1.75} className="text-[var(--success)] shrink-0" />
          <p className="text-[12.5px] text-[var(--text)] truncate">
            This lead is interested — generate a tailored follow-up?
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={generate} loading={generating}>
          Generate follow-up
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-md border border-[var(--border)] bg-white">
      <div className="px-3 py-2 border-b border-[var(--border)] flex items-center justify-between">
        <span className="text-[12px] uppercase tracking-[0.08em] font-semibold text-[var(--text-subtle)]">
          Suggested reply
        </span>
        <button
          type="button"
          onClick={() => setDraft(null)}
          aria-label="Discard"
          className="w-6 h-6 inline-flex items-center justify-center text-[var(--text-subtle)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] rounded transition-colors duration-100"
        >
          <X size={12} strokeWidth={1.75} />
        </button>
      </div>
      <div className="p-3 space-y-2">
        <input
          className="w-full bg-transparent text-[13.5px] font-medium text-[var(--text)] focus:outline-none"
          value={draft.subject}
          onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
          readOnly={!editing}
        />
        <textarea
          className="w-full bg-transparent text-[13px] text-[var(--text-muted)] leading-relaxed resize-y min-h-[120px] focus:outline-none"
          value={draft.body}
          onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          readOnly={!editing}
        />
      </div>
      <div className="px-3 py-2 border-t border-[var(--border)] flex items-center gap-2 justify-end">
        <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>
          {editing ? 'Stop editing' : 'Edit'}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setDraft(null)}>
          Discard
        </Button>
        <Button size="sm" variant="primary" onClick={send} loading={sending}>
          <Send size={12} strokeWidth={1.75} />
          Send
        </Button>
      </div>
    </div>
  );
}
