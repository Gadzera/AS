'use client';

/**
 * BulkActionModal — review-modal для bulk-действий Data Hub (согласовано с GPT:
 * мутации идут через подтверждение, а не молча).
 *   - 'campaign' — записать выбранные в кампанию (recipient-first, нужен email);
 *   - 'stage'    — проставить AI-SDR стадию (Push to Pipeline → agent_stage);
 *   - 'segment'  — сохранить выбранные/фильтр как сегмент (View).
 * Сбор ввода + подтверждение; сам вызов API делает родитель в onConfirm.
 */

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Loader2, Send, Radar, Layers } from 'lucide-react';
import { AGENT_STAGES } from '@/lib/crmApi';

export type BulkMode = 'campaign' | 'stage' | 'segment';

export interface BulkConfirmPayload {
  campaignId?: string;
  stage?: string;
  name?: string;
}

const STAGE_LABELS: Record<string, string> = {
  sourced: 'Sourced', researching: 'Researching', ready_to_engage: 'Ready to engage',
  engaging: 'Engaging', in_conversation: 'In conversation', meeting_set: 'Meeting set',
  handed_off: 'Handed off', nurture: 'Nurture', recycle: 'Recycle', suppressed: 'Suppressed',
  disqualified: 'Disqualified',
};

interface Props {
  mode: BulkMode;
  count: number;
  campaigns: { id: string; name: string }[];
  onConfirm: (payload: BulkConfirmPayload) => Promise<void>;
  onClose: () => void;
}

export default function BulkActionModal({ mode, count, campaigns, onConfirm, onClose }: Props) {
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? '');
  const [stage, setStage] = useState<string>('ready_to_engage');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, busy]);

  const meta = {
    campaign: { icon: <Send size={16} />, title: 'Add to campaign', cta: 'Add to campaign' },
    stage: { icon: <Radar size={16} />, title: 'Push to Pipeline', cta: 'Set stage' },
    segment: { icon: <Layers size={16} />, title: 'Save as view', cta: 'Save view' },
  }[mode];

  const canConfirm =
    mode === 'campaign' ? !!campaignId :
    mode === 'stage' ? !!stage :
    name.trim().length > 0;

  async function confirm() {
    if (!canConfirm || busy) return;
    setBusy(true);
    try {
      await onConfirm(
        mode === 'campaign' ? { campaignId } :
        mode === 'stage' ? { stage } :
        { name: name.trim() },
      );
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-[70] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          className="relative w-full max-w-[440px] overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
          initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }}
          transition={{ type: 'spring', stiffness: 440, damping: 34 }}
        >
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-brand-600">{meta.icon}</span>
              <div>
                <h2 className="text-[15px] font-bold text-ink">{meta.title}</h2>
                <p className="text-[12px] text-ink-muted">
                  {mode === 'segment' ? 'Current view · filter + sort' : `${count} selected records`}
                </p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-subtle hover:bg-surface-2 hover:text-ink"><X size={16} /></button>
          </div>

          <div className="space-y-3 px-5 py-4">
            {mode === 'campaign' && (
              <>
                <label className="block text-[12px] font-semibold uppercase tracking-[0.05em] text-ink-subtle">Campaign</label>
                <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className="h-9 w-full rounded-lg border border-line-strong bg-surface px-2.5 text-[13px] text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100">
                  {campaigns.length === 0 && <option value="">No campaigns</option>}
                  {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <p className="text-[11.5px] leading-4 text-ink-muted">Recipient-first: only records with an email get enrolled; records without an email go to “skipped” (need research/contact). Leads and enrollment are created for real and the agent starts working.</p>
              </>
            )}
            {mode === 'stage' && (
              <>
                <label className="block text-[12px] font-semibold uppercase tracking-[0.05em] text-ink-subtle">AI-SDR stage</label>
                <select value={stage} onChange={(e) => setStage(e.target.value)} className="h-9 w-full rounded-lg border border-line-strong bg-surface px-2.5 text-[13px] text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100">
                  {AGENT_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s] ?? s}</option>)}
                </select>
                <p className="text-[11.5px] leading-4 text-ink-muted">Written to the <code className="font-mono text-ink">agent_stage</code> field of the selected records — they show up in Pipeline Radar at this stage.</p>
              </>
            )}
            {mode === 'segment' && (
              <>
                <label className="block text-[12px] font-semibold uppercase tracking-[0.05em] text-ink-subtle">View name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Enterprise SaaS · DACH" className="h-9 w-full rounded-lg border border-line-strong bg-surface px-2.5 text-[13px] text-ink placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" />
                <p className="text-[11.5px] leading-4 text-ink-muted">Saves the current filter/sort as a View — it appears in the Views bar and persists in the database.</p>
              </>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
            <button type="button" onClick={onClose} className="h-9 rounded-lg px-3 text-[13px] font-medium text-ink-muted hover:bg-surface-2">Cancel</button>
            <button type="button" disabled={!canConfirm || busy} onClick={confirm} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-4 text-[13px] font-semibold text-white shadow-brand hover:bg-brand-700 disabled:opacity-60">
              {busy ? <Loader2 size={14} className="animate-spin" /> : meta.icon}
              {meta.cta}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
