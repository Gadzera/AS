'use client';

import { useState, useEffect } from 'react';
import { Mail, Linkedin } from 'lucide-react';
import clsx from 'clsx';
import type { Channel, CampaignStatus, CreateCampaignForm } from '@/types';
import { campaignsApi } from '@/lib/api';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

interface NewCampaignModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
  defaultStatus?: CampaignStatus;
}

const emptyForm: CreateCampaignForm = {
  name: '',
  channel: 'EMAIL',
  targetIndustry: '',
  targetCountry: '',
  targetSize: '',
  dailyLimit: 50,
};

export default function NewCampaignModal({
  open,
  onClose,
  onCreated,
}: NewCampaignModalProps) {
  const [form, setForm] = useState<CreateCampaignForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setForm(emptyForm);
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await campaignsApi.create({
        ...form,
        targetIndustry: form.targetIndustry || undefined,
        targetCountry: form.targetCountry || undefined,
        targetSize: form.targetSize || undefined,
      });
      onCreated?.();
      onClose();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Failed to create campaign';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const channels: { key: Channel; label: string; Icon: typeof Mail }[] = [
    { key: 'EMAIL', label: 'Email', Icon: Mail },
    { key: 'LINKEDIN', label: 'LinkedIn', Icon: Linkedin },
  ];

  return (
    <Modal open={open} onClose={onClose} title="New campaign" size="md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Campaign name"
          placeholder="Q3 SaaS Outreach"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          autoFocus
        />

        {/* Channel segmented */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--text-muted)]">Channel</label>
          <div className="inline-flex h-9 p-[2px] rounded-md bg-[var(--surface-2)] border border-[var(--border)] w-fit">
            {channels.map(({ key, label, Icon }) => {
              const active = form.channel === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setForm({ ...form, channel: key })}
                  className={clsx(
                    'inline-flex items-center gap-1.5 h-[30px] px-3 rounded-[5px] text-[12px] font-medium transition-colors duration-100',
                    active
                      ? 'bg-white text-[var(--text)] shadow-xs'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)]',
                  )}
                >
                  <Icon size={12} strokeWidth={1.75} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Target industry"
            placeholder="SaaS"
            value={form.targetIndustry ?? ''}
            onChange={(e) => setForm({ ...form, targetIndustry: e.target.value })}
          />
          <Input
            label="Target country"
            placeholder="United States"
            value={form.targetCountry ?? ''}
            onChange={(e) => setForm({ ...form, targetCountry: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Target company size"
            placeholder="50-199"
            value={form.targetSize ?? ''}
            onChange={(e) => setForm({ ...form, targetSize: e.target.value })}
          />
          <Input
            label="Daily limit"
            type="number"
            min={1}
            max={500}
            value={form.dailyLimit}
            onChange={(e) =>
              setForm({ ...form, dailyLimit: parseInt(e.target.value || '0', 10) || 50 })
            }
          />
        </div>

        {error && (
          <p className="text-[12px] text-[var(--danger)]">{error}</p>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            loading={submitting}
            disabled={!form.name.trim()}
          >
            Create campaign
          </Button>
        </div>
      </form>
    </Modal>
  );
}
