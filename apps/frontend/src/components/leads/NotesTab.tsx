'use client';

import { useState } from 'react';
import { StickyNote } from 'lucide-react';
import { format } from 'date-fns';
import Button from '@/components/ui/Button';
import { leadsApi } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import type { Lead } from '@/types';

interface NotesTabProps {
  lead: Lead;
  onChanged?: (lead: Lead) => void;
}

export default function NotesTab({ lead, onChanged }: NotesTabProps) {
  const toast = useToast();
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  // Notes are a single string field on Lead — render as paragraphs split on double newline.
  const existing = (lead.notes ?? '').trim();
  const paragraphs = existing
    ? existing.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean)
    : [];

  async function save() {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      const merged = existing ? `${existing}\n\n${draft.trim()}` : draft.trim();
      const updated = await leadsApi.update(lead.id, { notes: merged });
      onChanged?.(updated as Lead);
      setDraft('');
      toast.success('Note added');
    } catch (err: unknown) {
      const err_ = err as { response?: { data?: { error?: string } } };
      toast.error('Could not save note', err_?.response?.data?.error || 'Try again');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-6 py-6 max-w-3xl">
      <div className="rounded-lg border border-[var(--border)] bg-white">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add context, meeting notes, or follow-up ideas…"
          className="w-full h-32 px-3 py-2.5 text-[13.5px] text-[var(--text)] bg-transparent rounded-t-lg focus:outline-none placeholder:text-[var(--text-subtle)] resize-none"
        />
        <div className="border-t border-[var(--border)] px-2 h-10 flex items-center justify-end">
          <Button size="sm" variant="primary" onClick={save} loading={saving} disabled={!draft.trim()}>
            Add note
          </Button>
        </div>
      </div>

      <div className="mt-6">
        {paragraphs.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-12">
            <span className="w-14 h-14 rounded-full bg-[var(--surface-2)] inline-flex items-center justify-center text-[var(--text-subtle)] mb-3">
              <StickyNote size={24} strokeWidth={1.75} />
            </span>
            <h2 className="text-[16px] font-semibold text-[var(--text)]">No notes yet</h2>
            <p className="text-[13.5px] text-[var(--text-muted)] mt-1 max-w-[320px]">
              Add context about this lead so your team can pick up where you left off.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {paragraphs.map((p, i) => (
              <li
                key={i}
                className="rounded-md border border-[var(--border)] bg-white px-4 py-3"
              >
                <p className="text-[13.5px] text-[var(--text)] whitespace-pre-wrap leading-relaxed">
                  {p}
                </p>
                {i === paragraphs.length - 1 && lead.updatedAt && (
                  <p className="text-[11px] text-[var(--text-subtle)] mt-2">
                    Updated {format(new Date(lead.updatedAt), 'MMM d, yyyy')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
