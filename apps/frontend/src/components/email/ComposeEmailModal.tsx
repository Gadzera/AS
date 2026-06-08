'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  Braces,
  ChevronDown,
  Code2,
  Info,
  Minus,
  Paperclip,
  Smile,
  Trash2,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import TemplatePicker from './TemplatePicker';
import {
  composeStore,
  useCompose,
  type ComposeRecipient,
} from '@/lib/composeStore';
import { leadsApi } from '@/lib/api';
import type { Lead } from '@/types';

const MAX_RECIPIENT_SUGGESTIONS = 6;

function leadToRecipient(lead: Lead): ComposeRecipient {
  return {
    id: lead.id,
    name: `${lead.firstName} ${lead.lastName}`.trim() || lead.email || 'Unknown',
    email: lead.email ?? null,
    company: lead.company ?? null,
  };
}

/* -------------------------------------------------------------------------- */
/* Inner modal                                                                 */
/* -------------------------------------------------------------------------- */

function ComposeEmailModalInner() {
  const { recipients, leadId, initialSubject, initialBody } = useCompose();
  const toast = useToast();

  const [minimized, setMinimized] = useState(false);
  const [subject, setSubject] = useState(initialSubject ?? '');
  const [body, setBody] = useState(initialBody ?? '');
  const [sendIndividually, setSendIndividually] = useState(true);
  const [sending, setSending] = useState(false);

  // Template picker state
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  // Recipient autocomplete
  const [recipientInput, setRecipientInput] = useState('');
  const [suggestions, setSuggestions] = useState<Lead[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Reset state when modal is reopened with new payload
  useEffect(() => {
    setSubject(initialSubject ?? '');
    setBody(initialBody ?? '');
    setMinimized(false);
    setRecipientInput('');
    setShowTemplatePicker(false);
  }, [initialSubject, initialBody, leadId]);

  // Debounced recipient autocomplete via leadsApi
  useEffect(() => {
    const q = recipientInput.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const res = await leadsApi.list({ search: q, limit: MAX_RECIPIENT_SUGGESTIONS });
        if (cancelled) return;
        const existingIds = new Set(recipients.map((r) => r.id));
        setSuggestions(res.leads.filter((l) => !existingIds.has(l.id)));
      } catch {
        if (!cancelled) setSuggestions([]);
      }
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [recipientInput, recipients]);

  const onSubjectFocus = () => {
    if (subject.trim().length === 0 && body.trim().length === 0) {
      setShowTemplatePicker(true);
    }
  };

  const onSubjectBlur = () => {
    // Defer so a click inside the picker can register first
    setTimeout(() => setShowTemplatePicker(false), 120);
  };

  const handlePickTemplate = useCallback(
    (tpl: { subject: string; body: string }) => {
      setSubject(tpl.subject);
      setBody(tpl.body);
      setShowTemplatePicker(false);
    },
    [],
  );

  const handleAddRecipient = (lead: Lead) => {
    composeStore.addRecipient(leadToRecipient(lead));
    setRecipientInput('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleRecipientKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && recipientInput.length === 0 && recipients.length > 0) {
      composeStore.removeRecipient(recipients[recipients.length - 1].id);
    }
    if (e.key === 'Enter' && suggestions.length > 0) {
      e.preventDefault();
      handleAddRecipient(suggestions[0]);
    }
  };

  const recipientCount = recipients.length;

  const handleSend = async () => {
    if (recipientCount === 0) {
      toast.error('Add at least one recipient');
      return;
    }
    if (subject.trim().length === 0) {
      toast.error('Subject is required');
      return;
    }
    setSending(true);
    try {
      // Demo behaviour: the backend has no single-shot send endpoint outside a
      // campaign. We simulate the send with a small artificial delay so the UI
      // can react. In production this would hit POST /api/outreach/send.
      await new Promise((r) => setTimeout(r, 400));
      toast.success(
        recipientCount === 1
          ? `Email sent to ${recipients[0].name}`
          : `Email sent to ${recipientCount} recipients`,
      );
      composeStore.close();
      composeStore.reset();
    } catch (err) {
      toast.error('Failed to send email', err instanceof Error ? err.message : undefined);
    } finally {
      setSending(false);
    }
  };

  const handleDiscard = () => {
    composeStore.close();
    composeStore.reset();
  };

  const sendLabel = useMemo(() => {
    return recipientCount > 0
      ? `Send Email (${recipientCount})`
      : 'Send Email';
  }, [recipientCount]);

  /* -------------------------- Minimized state -------------------------- */
  if (minimized) {
    return (
      <motion.button
        type="button"
        onClick={() => setMinimized(false)}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        className="fixed bottom-4 right-6 z-50 h-10 px-3 inline-flex items-center gap-2 bg-white border border-[var(--border)] rounded-lg text-[13px] text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
        style={{ boxShadow: 'var(--shadow-popover)' }}
      >
        <ChevronDown size={14} strokeWidth={1.75} className="-rotate-180 text-[var(--text-muted)]" />
        <span className="font-medium">Compose email</span>
        {recipientCount > 0 && (
          <span className="text-[12px] text-[var(--text-muted)] tabular-nums">
            ({recipientCount})
          </span>
        )}
      </motion.button>
    );
  }

  /* -------------------------- Full modal ------------------------------- */
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className="absolute inset-0 bg-[#0f0f0e]/55"
        onClick={() => setMinimized(true)}
        aria-hidden
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        role="dialog"
        aria-label="Compose email"
        className="relative z-10 w-full mx-4 max-w-[720px] h-[560px] bg-white rounded-xl flex flex-col overflow-hidden"
        style={{ boxShadow: 'var(--shadow-lg)' }}
      >
        {/* Header */}
        <div className="h-12 px-4 border-b border-[var(--border)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {showTemplatePicker && (
              <button
                type="button"
                aria-label="Back"
                onClick={() => setShowTemplatePicker(false)}
                className="w-7 h-7 rounded-md inline-flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors duration-100"
              >
                <ArrowLeft size={14} strokeWidth={1.75} />
              </button>
            )}
            <span className="text-[14px] font-semibold text-[var(--text)] leading-none">
              Compose email
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              aria-label="Minimize"
              onClick={() => setMinimized(true)}
              className="w-7 h-7 rounded-md inline-flex items-center justify-center text-[var(--text-subtle)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors duration-100"
            >
              <Minus size={14} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              aria-label="Close"
              onClick={handleDiscard}
              className="w-7 h-7 rounded-md inline-flex items-center justify-center text-[var(--text-subtle)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors duration-100"
            >
              <X size={14} strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {/* Recipients */}
        <div className="px-4 h-11 flex items-center gap-2 border-b border-[var(--border)] shrink-0 relative">
          <span className="text-[12px] text-[var(--text-subtle)] font-medium">To:</span>
          <div className="flex-1 flex items-center gap-1.5 flex-wrap min-w-0">
            {recipients.map((r) => (
              <span
                key={r.id}
                className="inline-flex items-center gap-1.5 h-6 pl-1 pr-1.5 rounded-md bg-[var(--surface-2)] text-[12.5px] text-[var(--text)]"
              >
                <Avatar name={r.name} size={16} />
                <span className="truncate max-w-[160px]">{r.name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${r.name}`}
                  onClick={() => composeStore.removeRecipient(r.id)}
                  className="w-4 h-4 rounded inline-flex items-center justify-center text-[var(--text-subtle)] hover:text-[var(--text)] hover:bg-white transition-colors duration-100"
                >
                  <X size={10} strokeWidth={1.75} />
                </button>
              </span>
            ))}
            <input
              type="text"
              value={recipientInput}
              onChange={(e) => {
                setRecipientInput(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
              onKeyDown={handleRecipientKey}
              placeholder={recipients.length === 0 ? 'Add recipients…' : ''}
              className="flex-1 min-w-[120px] h-7 bg-transparent outline-none text-[13px] text-[var(--text)] placeholder:text-[var(--text-subtle)]"
            />
          </div>

          {showSuggestions && suggestions.length > 0 && (
            <div
              className="absolute left-12 right-4 top-10 z-30 bg-white border border-[var(--border)] rounded-lg overflow-hidden"
              style={{ boxShadow: 'var(--shadow-popover)' }}
            >
              <ul className="max-h-[220px] overflow-y-auto py-1">
                {suggestions.map((lead) => (
                  <li key={lead.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleAddRecipient(lead)}
                      className="w-full h-9 px-2.5 flex items-center gap-2 hover:bg-[var(--surface-2)] transition-colors duration-100 text-left"
                    >
                      <Avatar name={`${lead.firstName} ${lead.lastName}`} size={20} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] text-[var(--text)] truncate leading-none">
                          {lead.firstName} {lead.lastName}
                        </div>
                        <div className="text-[12px] text-[var(--text-muted)] truncate mt-0.5 leading-none">
                          {lead.email ?? lead.company ?? ''}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Subject */}
        <div className="px-4 h-10 flex items-center border-b border-[var(--border)] shrink-0 relative">
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onFocus={onSubjectFocus}
            onBlur={onSubjectBlur}
            placeholder="Subject"
            className={clsx(
              'w-full h-9 bg-transparent outline-none border-0',
              'text-[14px] font-medium text-[var(--text)] placeholder:text-[var(--text-subtle)] placeholder:font-normal',
            )}
          />

          {/* Template picker dropdown anchored below subject */}
          <AnimatePresence>
            {showTemplatePicker && (
              <div
                className="absolute left-3 right-3 top-10 z-30"
                onMouseDown={(e) => e.preventDefault()}
              >
                <TemplatePicker
                  open
                  onPick={handlePickTemplate}
                  onClose={() => setShowTemplatePicker(false)}
                />
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Body */}
        <div className="flex-1 px-4 py-3 min-h-0">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your email or pick a template…"
            className="w-full h-full resize-none bg-transparent outline-none border-0 text-[13.5px] leading-5 text-[var(--text)] placeholder:text-[var(--text-subtle)]"
          />
        </div>

        {/* Footer */}
        <div className="h-12 px-3 border-t border-[var(--border)] flex items-center justify-between shrink-0 gap-2">
          <div className="flex items-center gap-0.5">
            <ToolbarButton aria-label="Attach file"><Paperclip size={14} strokeWidth={1.75} /></ToolbarButton>
            <ToolbarButton aria-label="Personalization tokens"><Braces size={14} strokeWidth={1.75} /></ToolbarButton>
            <ToolbarButton aria-label="Insert code"><Code2 size={14} strokeWidth={1.75} /></ToolbarButton>
            <ToolbarButton aria-label="Insert emoji"><Smile size={14} strokeWidth={1.75} /></ToolbarButton>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Switch checked={sendIndividually} onChange={setSendIndividually} />
            <span className="text-[13px] text-[var(--text-muted)]">Send emails individually</span>
            <span
              title="When enabled, each recipient receives a separate, personalized message and cannot see other recipients."
              className="text-[var(--text-subtle)] inline-flex"
            >
              <Info size={12} strokeWidth={1.75} />
            </span>
          </label>

          <div className="flex items-center gap-1.5">
            <ToolbarButton aria-label="Discard" onClick={handleDiscard}>
              <Trash2 size={14} strokeWidth={1.75} />
            </ToolbarButton>
            <Button
              variant="primary"
              size="sm"
              loading={sending}
              onClick={handleSend}
            >
              <span className="tabular-nums">{sendLabel}</span>
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Toolbar button                                                              */
/* -------------------------------------------------------------------------- */

function ToolbarButton({
  children,
  onClick,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...rest}
      className="w-7 h-7 rounded-md inline-flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors duration-100"
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Switch                                                                      */
/* -------------------------------------------------------------------------- */

function Switch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={(e) => {
        e.preventDefault();
        onChange(!checked);
      }}
      className={clsx(
        'relative w-7 h-4 rounded-full transition-colors duration-150',
        checked ? 'bg-[var(--text)]' : 'bg-[var(--border-strong)]',
      )}
    >
      <span
        className={clsx(
          'absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform duration-150',
          checked && 'translate-x-3',
        )}
      />
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Root — mount in dashboard layout                                            */
/* -------------------------------------------------------------------------- */

export default function ComposeEmailModalRoot() {
  const { isOpen } = useCompose();
  return (
    <AnimatePresence>
      {isOpen && <ComposeEmailModalInner key="compose-modal" />}
    </AnimatePresence>
  );
}
