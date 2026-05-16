'use client';

import { useState } from 'react';
import type { Sequence } from '@/types';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import EmailEditor from '@/components/ui/EmailEditor';
import { sequencesApi, outreachApi } from '@/lib/api';

interface SequenceBuilderProps {
  campaignId: string;
  sequences: Sequence[];
  abTestEnabled?: boolean;
  onUpdate: () => void;
}

const CHANNEL_COLORS: Record<string, string> = {
  EMAIL: 'bg-brand-500/10 text-brand-400 border border-brand-500/20',
  LINKEDIN: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
};

export default function SequenceBuilder({ campaignId, sequences, abTestEnabled = false, onUpdate }: SequenceBuilderProps) {
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState({
    subject: '',
    body: '',
    subjectB: '',
    bodyB: '',
    delayDays: 0,
    channel: 'EMAIL' as 'EMAIL' | 'LINKEDIN',
  });

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await outreachApi.generate({
        campaignId,
        language: 'en',
        tone: 'professional',
      });
      setForm(f => ({ ...f, subject: res.subject || f.subject, body: res.body }));
    } catch {
      // keep current
    } finally {
      setGenerating(false);
    }
  };

  const handleAdd = async () => {
    const plainBody = form.body.replace(/<[^>]*>/g, '').trim();
    if (!plainBody) return;
    setSaving(true);
    try {
      await sequencesApi.create(campaignId, {
        stepNumber: sequences.length + 1,
        delayDays: form.delayDays,
        subject: form.subject || undefined,
        body: form.body,
        channel: form.channel,
        ...(abTestEnabled && {
          subjectB: form.subjectB || undefined,
          bodyB: form.bodyB || undefined,
        }),
      });
      setForm({ subject: '', body: '', subjectB: '', bodyB: '', delayDays: 0, channel: 'EMAIL' });
      setAdding(false);
      onUpdate();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try { await sequencesApi.delete(id); onUpdate(); } catch { /* noop */ }
  };

  return (
    <div className="space-y-3">
      {sequences.length === 0 && !adding && (
        <div className="text-center py-10 text-gray-600">
          <svg className="w-10 h-10 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <p className="text-sm">Нет шагов. Добавьте первое сообщение.</p>
        </div>
      )}

      {/* Existing steps */}
      {sequences.map((step, idx) => (
        <div key={step.id} className="relative flex gap-3">
          <div className="flex flex-col items-center pt-1">
            <div className="w-7 h-7 bg-brand-500/20 border border-brand-500/30 text-brand-400 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
              {step.stepNumber}
            </div>
            {idx < sequences.length - 1 && (
              <div className="w-px flex-1 bg-gray-700/50 mt-2" />
            )}
          </div>

          <div className="flex-1 bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 mb-2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${CHANNEL_COLORS[step.channel]}`}>
                  {step.channel}
                </span>
                {step.delayDays > 0 && (
                  <span className="text-xs text-gray-500">
                    через {step.delayDays} {step.delayDays === 1 ? 'день' : step.delayDays < 5 ? 'дня' : 'дней'}
                  </span>
                )}
                {step.delayDays === 0 && idx === 0 && (
                  <span className="text-xs text-gray-500">сразу при старте</span>
                )}
              </div>
              <button onClick={() => handleDelete(step.id)} className="text-gray-600 hover:text-red-400 transition-colors p-1 rounded">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>

            {step.subject && (
              <p className="text-xs font-medium text-gray-400 mb-1.5">
                Тема: <span className="text-gray-200">{step.subject}</span>
              </p>
            )}
            <div
              className="text-sm text-gray-400 line-clamp-3 prose prose-sm prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: step.body }}
            />
            {abTestEnabled && step.bodyB && (
              <div className="mt-3 pt-3 border-t border-yellow-500/20">
                <p className="text-[10px] font-semibold text-yellow-500 uppercase tracking-wide mb-1">Variant B</p>
                {step.subjectB && (
                  <p className="text-xs font-medium text-gray-400 mb-1">
                    Тема: <span className="text-gray-200">{step.subjectB}</span>
                  </p>
                )}
                <div
                  className="text-sm text-gray-400 line-clamp-2 prose prose-sm prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: step.bodyB }}
                />
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Add step form */}
      {adding && (
        <div className="bg-gray-800/60 border border-brand-500/20 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-white text-sm">Шаг {sequences.length + 1}</h4>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-brand-500/10 border border-brand-500/20 text-brand-400 hover:bg-brand-500/20 transition-colors disabled:opacity-50"
            >
              {generating ? (
                <><span className="w-3 h-3 border border-brand-400 border-t-transparent rounded-full animate-spin" />Генерирую...</>
              ) : (
                <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>Написать за меня</>
              )}
            </button>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1 block">Канал</label>
              <select
                className="block w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                value={form.channel}
                onChange={(e) => setForm({ ...form, channel: e.target.value as 'EMAIL' | 'LINKEDIN' })}
              >
                <option value="EMAIL">Email</option>
                <option value="LINKEDIN">LinkedIn</option>
              </select>
            </div>
            <div className="w-36">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1 block">Задержка (дней)</label>
              <input
                type="number"
                min={0}
                className="block w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                value={form.delayDays}
                onChange={(e) => setForm({ ...form, delayDays: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>

          {form.channel === 'EMAIL' && (
            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1 block">Тема письма</label>
              <input
                className="block w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                placeholder="Например: Вопрос насчёт {{company}}"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
              />
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1 block">Текст сообщения</label>
            <EmailEditor
              value={form.body}
              onChange={(html) => setForm({ ...form, body: html })}
              placeholder={form.channel === 'EMAIL' ? 'Напишите текст письма или нажмите «Написать за меня»...' : 'Текст для LinkedIn...'}
              minHeight={180}
            />
          </div>

          {abTestEnabled && (
            <div className="border border-yellow-500/20 bg-yellow-500/5 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-yellow-400 uppercase tracking-wide">Variant B</p>
              {form.channel === 'EMAIL' && (
                <div>
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1 block">Тема письма — Вариант B</label>
                  <input
                    className="block w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-500/30"
                    placeholder="Альтернативная тема для A/B теста"
                    value={form.subjectB}
                    onChange={(e) => setForm({ ...form, subjectB: e.target.value })}
                  />
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1 block">Текст сообщения — Вариант B</label>
                <EmailEditor
                  value={form.bodyB}
                  onChange={(html) => setForm({ ...form, bodyB: html })}
                  placeholder="Альтернативный текст для A/B теста..."
                  minHeight={140}
                />
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button onClick={handleAdd} loading={saving}>
              Сохранить шаг
            </Button>
            <Button variant="secondary" onClick={() => { setAdding(false); setForm({ subject: '', body: '', delayDays: 0, channel: 'EMAIL' }); }}>
              Отмена
            </Button>
          </div>
        </div>
      )}

      {!adding && (
        <button
          onClick={() => setAdding(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-700 hover:border-brand-500/40 text-gray-600 hover:text-brand-400 transition-colors text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Добавить шаг последовательности
        </button>
      )}
    </div>
  );
}
