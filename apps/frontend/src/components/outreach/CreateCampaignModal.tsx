'use client';

/* CreateCampaignModal — создание кампании (M6). Реальный POST /api/campaigns. */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Send, Loader2 } from 'lucide-react';
import { campaignsApi } from '@/lib/api';
import type { Channel } from '@/types';

export default function CreateCampaignModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('');
  const [channel, setChannel] = useState<Channel>('EMAIL');
  const [industry, setIndustry] = useState('');
  const [dailyLimit, setDailyLimit] = useState(50);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    if (!name.trim()) { setErr('Введите название кампании'); return; }
    setSaving(true); setErr('');
    try {
      const c = await campaignsApi.create({ name: name.trim(), channel, targetIndustry: industry.trim() || undefined, dailyLimit });
      onCreated(c.id);
      onClose();
    } catch (e: unknown) {
      setErr((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Не удалось создать кампанию');
      setSaving(false);
    }
  }

  return (
    <>
      <motion.div className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <motion.div
          className="w-full max-w-md rounded-2xl border border-line bg-surface shadow-2xl"
          initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="text-[15px] font-bold text-ink">New campaign</h2>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-ink-subtle hover:bg-surface-2 hover:text-ink"><X size={17} /></button>
          </div>
          <div className="space-y-3 px-5 py-4">
            <div>
              <label className="mb-1 block text-[11.5px] font-semibold text-ink-muted">Name <span className="text-rose-500">*</span></label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. RevOps efficiency · Q3" className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-[13px] text-ink outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[11.5px] font-semibold text-ink-muted">Channel</label>
                <select value={channel} onChange={(e) => setChannel(e.target.value as Channel)} className="h-10 w-full rounded-lg border border-line bg-surface px-2 text-[13px] text-ink outline-none focus:border-brand-400">
                  <option value="EMAIL">Email</option>
                  <option value="LINKEDIN">LinkedIn</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11.5px] font-semibold text-ink-muted">Daily limit</label>
                <input type="number" value={dailyLimit} onChange={(e) => setDailyLimit(Math.max(1, Number(e.target.value) || 1))} className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-[13px] text-ink outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[11.5px] font-semibold text-ink-muted">Target industry</label>
              <input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="optional" className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-[13px] text-ink outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
            </div>
            {err && <p className="text-[12px] font-medium text-rose-600">{err}</p>}
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
            <button type="button" onClick={onClose} className="h-9 rounded-lg px-3 text-[13px] font-medium text-ink-muted hover:text-ink">Cancel</button>
            <button type="button" disabled={!name.trim() || saving} onClick={save} className="brand-gradient inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-[13px] font-semibold text-white shadow-brand disabled:opacity-60">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Create
            </button>
          </div>
        </motion.div>
      </div>
    </>
  );
}
