'use client';

import { useEffect, useState } from 'react';
import Topbar from '@/components/layout/Topbar';
import EmailEditor from '@/components/ui/EmailEditor';
import { templatesApi } from '@/lib/api';

type Channel = 'EMAIL' | 'LINKEDIN';

interface Template {
  id: string;
  name: string;
  subject?: string | null;
  body: string;
  channel: Channel;
  updatedAt: string;
}

// ── Built-in starter templates ────────────────────────────────────────────────
const STARTERS: Omit<Template, 'id' | 'updatedAt'>[] = [
  {
    name: 'Холодное знакомство',
    channel: 'EMAIL',
    subject: 'Быстрый вопрос, {{firstName}}',
    body: `<p>Привет, {{firstName}},</p><p>Увидел {{company}} и захотел написать — работаю с компаниями вашего профиля и часто помогаю им [ваша ценность].</p><p>Было бы интересно пообщаться 15 минут? Когда вам удобно?</p><p>С уважением,</p>`,
  },
  {
    name: 'Follow-up после тишины',
    channel: 'EMAIL',
    subject: 'Re: Быстрый вопрос, {{firstName}}',
    body: `<p>{{firstName}}, не хочу быть навязчивым — просто хотел убедиться что моё письмо не потерялось.</p><p>Если сейчас не актуально — просто дайте знать, не обижусь.</p><p>Если интересно — готов подстроиться под ваш график.</p>`,
  },
  {
    name: 'LinkedIn знакомство',
    channel: 'LINKEDIN',
    subject: '',
    body: `<p>{{firstName}}, видел ваш профиль — впечатляющая работа в {{company}}. Занимаюсь [ваша ниша] и хотел бы познакомиться. Будем на связи?</p>`,
  },
  {
    name: 'Партнёрское предложение',
    channel: 'EMAIL',
    subject: 'Идея сотрудничества для {{company}}',
    body: `<p>{{firstName}}, добрый день.</p><p>Вижу, что {{company}} активно развивается в [направление]. У нас есть решение, которое уже помогло похожим компаниям [конкретный результат].</p><p>Могу поделиться кейсом за 10 минут в Zoom — удобно на этой неделе?</p>`,
  },
];

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<Channel | 'ALL'>('ALL');

  const [form, setForm] = useState({ name: '', subject: '', body: '', channel: 'EMAIL' as Channel });

  const load = () => {
    setLoading(true);
    templatesApi.list().then(setTemplates).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.name || !form.body) return;
    setSaving(true);
    try {
      if (selected) {
        await templatesApi.update(selected.id, { name: form.name, subject: form.subject, body: form.body });
      } else {
        await templatesApi.create({ name: form.name, subject: form.subject, body: form.body, channel: form.channel });
      }
      load();
      setSelected(null);
      setCreating(false);
      setForm({ name: '', subject: '', body: '', channel: 'EMAIL' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить шаблон?')) return;
    await templatesApi.delete(id);
    if (selected?.id === id) { setSelected(null); setCreating(false); }
    load();
  };

  const handleSelect = (t: Template) => {
    setSelected(t);
    setCreating(true);
    setForm({ name: t.name, subject: t.subject ?? '', body: t.body, channel: t.channel });
  };

  const handleStarterUse = (s: typeof STARTERS[0]) => {
    setSelected(null);
    setCreating(true);
    setForm({ name: s.name, subject: s.subject ?? '', body: s.body, channel: s.channel });
  };

  const filtered = filter === 'ALL' ? templates : templates.filter(t => t.channel === filter);

  return (
    <>
      <Topbar title="Шаблоны писем" />
      <main className="flex-1 flex overflow-hidden">

        {/* ── Left sidebar: list ── */}
        <div className="w-72 shrink-0 border-r border-gray-800 flex flex-col">
          {/* Filter tabs */}
          <div className="flex border-b border-gray-800">
            {(['ALL', 'EMAIL', 'LINKEDIN'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`flex-1 py-2.5 text-xs font-medium transition-colors ${filter === f ? 'text-brand-400 border-b-2 border-brand-500' : 'text-gray-500 hover:text-gray-300'}`}>
                {f === 'ALL' ? 'Все' : f}
              </button>
            ))}
          </div>

          {/* New template button */}
          <button
            onClick={() => { setSelected(null); setCreating(true); setForm({ name: '', subject: '', body: '', channel: 'EMAIL' }); }}
            className="mx-3 mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-500/10 border border-brand-500/20 text-brand-400 hover:bg-brand-500/20 transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Новый шаблон
          </button>

          <div className="flex-1 overflow-y-auto py-2 px-3 space-y-1">
            {/* My templates */}
            {loading ? (
              <div className="space-y-2 mt-2">
                {[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-gray-800/60 rounded-lg animate-pulse" />)}
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-gray-600 text-center mt-4">Нет сохранённых шаблонов</p>
            ) : filtered.map(t => (
              <div
                key={t.id}
                onClick={() => handleSelect(t)}
                className={`group flex items-start gap-2 p-3 rounded-lg cursor-pointer transition-colors ${selected?.id === t.id ? 'bg-brand-500/10 border border-brand-500/20' : 'hover:bg-gray-800/50'}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-200 truncate">{t.name}</p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    <span className={`${t.channel === 'EMAIL' ? 'text-brand-500' : 'text-blue-500'}`}>{t.channel}</span>
                    {' · '}{new Date(t.updatedAt).toLocaleDateString('ru', { day: '2-digit', month: 'short' })}
                  </p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
                  className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all p-0.5 shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}

            {/* Starter templates divider */}
            <div className="pt-3 pb-1">
              <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider px-1">Готовые шаблоны</p>
            </div>
            {STARTERS.map((s, i) => (
              <div key={i} onClick={() => handleStarterUse(s)}
                className="flex items-start gap-2 p-3 rounded-lg cursor-pointer hover:bg-gray-800/50 transition-colors border border-gray-800/50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-400 truncate">{s.name}</p>
                  <p className={`text-xs mt-0.5 ${s.channel === 'EMAIL' ? 'text-brand-500/70' : 'text-blue-500/70'}`}>{s.channel}</p>
                </div>
                <span className="text-[10px] text-gray-600 shrink-0 mt-1">использовать →</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: editor ── */}
        <div className="flex-1 overflow-y-auto">
          {!creating ? (
            <div className="h-full flex items-center justify-center text-center px-8">
              <div>
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-500 text-sm">Выберите шаблон или создайте новый</p>
                <p className="text-gray-700 text-xs mt-1">Шаблоны позволяют быстро вставлять готовые письма в кампании</p>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-5 max-w-3xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">
                  {selected ? 'Редактировать шаблон' : 'Новый шаблон'}
                </h2>
                <div className="flex gap-2">
                  <button onClick={() => { setCreating(false); setSelected(null); }}
                    className="text-sm text-gray-500 hover:text-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors">
                    Отмена
                  </button>
                  <button onClick={handleSave} disabled={saving || !form.name || !form.body}
                    className="text-sm bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg transition-colors font-medium">
                    {saving ? 'Сохраняю...' : 'Сохранить'}
                  </button>
                </div>
              </div>

              {/* Name + Channel */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1 block">Название шаблона</label>
                  <input
                    className="block w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    placeholder="Холодное знакомство, Follow-up #1..."
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="w-36">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1 block">Канал</label>
                  <select
                    className="block w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    value={form.channel}
                    onChange={e => setForm(f => ({ ...f, channel: e.target.value as Channel }))}
                    disabled={!!selected}
                  >
                    <option value="EMAIL">Email</option>
                    <option value="LINKEDIN">LinkedIn</option>
                  </select>
                </div>
              </div>

              {/* Subject */}
              {form.channel === 'EMAIL' && (
                <div>
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1 block">Тема письма</label>
                  <input
                    className="block w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    placeholder="Тема — можно использовать {{firstName}}, {{company}}"
                    value={form.subject}
                    onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  />
                </div>
              )}

              {/* Body */}
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1 block">Текст</label>
                <EmailEditor
                  value={form.body}
                  onChange={html => setForm(f => ({ ...f, body: html }))}
                  placeholder="Напишите текст письма. Используйте кнопки переменных выше для персонализации."
                  minHeight={280}
                />
              </div>

              <div className="bg-gray-800/40 rounded-lg px-4 py-3 text-xs text-gray-500 leading-relaxed">
                💡 Используйте <code className="text-indigo-400 bg-indigo-900/30 px-1 rounded">{'{{firstName}}'}</code>, <code className="text-indigo-400 bg-indigo-900/30 px-1 rounded">{'{{company}}'}</code> и другие переменные — они заменятся на реальные данные лида при отправке.
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
