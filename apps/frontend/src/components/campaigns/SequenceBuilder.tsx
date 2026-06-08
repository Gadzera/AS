'use client';

import { useState } from 'react';
import type { Sequence } from '@/types';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { sequencesApi } from '@/lib/api';

interface SequenceBuilderProps {
  campaignId: string;
  sequences: Sequence[];
  onUpdate: () => void;
}

export default function SequenceBuilder({
  campaignId,
  sequences,
  onUpdate,
}: SequenceBuilderProps) {
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    subject: '',
    body: '',
    delayDays: 0,
    channel: 'EMAIL' as 'EMAIL' | 'LINKEDIN',
  });

  const handleAdd = async () => {
    if (!form.body.trim()) return;
    setSaving(true);
    try {
      await sequencesApi.create(campaignId, {
        stepNumber: sequences.length + 1,
        delayDays: form.delayDays,
        subject: form.subject || undefined,
        body: form.body,
        channel: form.channel,
      });
      setForm({ subject: '', body: '', delayDays: 0, channel: 'EMAIL' });
      setAdding(false);
      onUpdate();
    } catch (err) {
      console.error('Failed to add step:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await sequencesApi.delete(id);
      onUpdate();
    } catch (err) {
      console.error('Failed to delete step:', err);
    }
  };

  return (
    <div className="space-y-4">
      {sequences.length === 0 && !adding && (
        <p className="text-ink-muted text-sm text-center py-6">
          No sequence steps yet. Add your first message below.
        </p>
      )}

      {/* Existing steps */}
      {sequences.map((step, idx) => (
        <div key={step.id} className="relative flex gap-4">
          {/* Timeline connector */}
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 bg-blue-600 text-ink rounded-full flex items-center justify-center text-sm font-bold shrink-0">
              {step.stepNumber}
            </div>
            {idx < sequences.length - 1 && (
              <div className="w-0.5 h-full bg-gray-200 mt-2" />
            )}
          </div>

          {/* Step content */}
          <div className="flex-1 bg-gray-50 rounded-lg p-4 mb-2">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                  {step.channel}
                </span>
                {step.delayDays > 0 && (
                  <span className="text-xs text-ink-muted">
                    +{step.delayDays} day{step.delayDays !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <button
                onClick={() => handleDelete(step.id)}
                className="text-ink-muted hover:text-red-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
            {step.subject && (
              <p className="text-sm font-medium text-gray-900 mb-1">
                Subject: {step.subject}
              </p>
            )}
            <p className="text-sm text-ink-subtle whitespace-pre-wrap line-clamp-3">{step.body}</p>
          </div>
        </div>
      ))}

      {/* Add step form */}
      {adding && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
          <h4 className="font-medium text-gray-900">Step {sequences.length + 1}</h4>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-sm font-medium text-ink-subtle">Channel</label>
              <select
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.channel}
                onChange={(e) => setForm({ ...form, channel: e.target.value as 'EMAIL' | 'LINKEDIN' })}
              >
                <option value="EMAIL">Email</option>
                <option value="LINKEDIN">LinkedIn</option>
              </select>
            </div>
            <div className="w-32">
              <Input
                label="Delay (days)"
                type="number"
                min={0}
                value={form.delayDays}
                onChange={(e) => setForm({ ...form, delayDays: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>

          {form.channel === 'EMAIL' && (
            <Input
              label="Subject"
              placeholder="Email subject line..."
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
          )}

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-ink-subtle">Message body</label>
            <textarea
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={5}
              placeholder="Write your message here..."
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleAdd} loading={saving} disabled={!form.body.trim()}>
              Save Step
            </Button>
            <Button variant="secondary" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {!adding && (
        <Button
          variant="secondary"
          onClick={() => setAdding(true)}
          className="w-full border-dashed"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Sequence Step
        </Button>
      )}
    </div>
  );
}
