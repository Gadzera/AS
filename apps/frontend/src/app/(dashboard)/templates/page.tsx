'use client';

import { useEffect, useState } from 'react';
import Topbar from '@/components/layout/Topbar';
import EmailEditor from '@/components/ui/EmailEditor';
import Modal from '@/components/ui/Modal';
import { templatesApi, campaignsApi } from '@/lib/api';
import type { Campaign } from '@/types';

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
    name: 'Cold Introduction',
    channel: 'EMAIL',
    subject: 'Quick question, {{firstName}}',
    body: `<p>Hi {{firstName}},</p><p>I came across {{company}} and wanted to reach out — I work with companies in your space and often help them [your value prop].</p><p>Would you be open to a quick 15-minute call? Happy to work around your schedule.</p><p>Best,</p>`,
  },
  {
    name: 'Follow-up After Silence',
    channel: 'EMAIL',
    subject: 'Re: Quick question, {{firstName}}',
    body: `<p>{{firstName}}, just wanted to make sure my last email didn't get lost.</p><p>If now isn't a good time, no worries at all — just let me know.</p><p>If you're interested, I'm happy to work around your schedule.</p>`,
  },
  {
    name: 'LinkedIn Introduction',
    channel: 'LINKEDIN',
    subject: '',
    body: `<p>{{firstName}}, I came across your profile — impressive work at {{company}}. I'm focused on [your niche] and thought it'd be great to connect. Worth staying in touch?</p>`,
  },
  {
    name: 'Partnership Proposal',
    channel: 'EMAIL',
    subject: 'Collaboration idea for {{company}}',
    body: `<p>Hi {{firstName}},</p><p>I see that {{company}} is actively growing in [direction]. We have a solution that has already helped similar companies achieve [specific result].</p><p>I can share a case study in 10 minutes on Zoom — does this week work for you?</p>`,
  },
];

// ── Strip HTML for preview snippet ──────────────────────────────────────────
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// ── Preview pane ─────────────────────────────────────────────────────────────
function TemplatePreview({ template, onEdit, onUseCampaign }: {
  template: Template;
  onEdit: () => void;
  onUseCampaign: () => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">{template.name}</h2>
            <div className="flex items-center gap-3 mt-1">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                template.channel === 'EMAIL'
                  ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20'
                  : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
              }`}>
                {template.channel}
              </span>
              <span className="text-xs text-gray-600">
                Updated {new Date(template.updatedAt).toLocaleDateString('en', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onUseCampaign}
              className="flex items-center gap-2 text-sm bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Use in Campaign
            </button>
            <button
              onClick={onEdit}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
          </div>
        </div>

        {/* Subject line */}
        {template.channel === 'EMAIL' && template.subject && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Subject</p>
            <p className="text-sm text-gray-200">{template.subject}</p>
          </div>
        )}

        {/* Body preview */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-800 flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Preview</span>
            <span className="text-xs text-gray-700">— variables will be replaced with lead data when sent</span>
          </div>
          <div
            className="p-5 text-sm text-gray-300 leading-relaxed prose prose-invert prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: template.body }}
          />
        </div>

        {/* Variable hints */}
        <div className="bg-gray-800/40 rounded-lg px-4 py-3 text-xs text-gray-500 leading-relaxed">
          Available variables:{' '}
          {['{{firstName}}', '{{lastName}}', '{{company}}', '{{email}}', '{{title}}'].map(v => (
            <code key={v} className="text-indigo-400 bg-indigo-900/30 px-1 rounded mx-0.5">{v}</code>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<Channel | 'ALL'>('ALL');
  const [search, setSearch] = useState('');

  // Campaign picker state
  const [showCampaignPicker, setShowCampaignPicker] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [templateForCampaign, setTemplateForCampaign] = useState<Template | null>(null);

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
    if (!confirm('Delete this template?')) return;
    await templatesApi.delete(id);
    if (selected?.id === id) { setSelected(null); setCreating(false); }
    load();
  };

  const handleSelect = (t: Template) => {
    setSelected(t);
    setCreating(false);
    setForm({ name: t.name, subject: t.subject ?? '', body: t.body, channel: t.channel });
  };

  const handleEdit = () => {
    if (!selected) return;
    setCreating(true);
  };

  const handleStarterUse = (s: typeof STARTERS[0]) => {
    setSelected(null);
    setCreating(true);
    setForm({ name: s.name, subject: s.subject ?? '', body: s.body, channel: s.channel });
  };

  const handleOpenCampaignPicker = (t: Template) => {
    setTemplateForCampaign(t);
    setShowCampaignPicker(true);
    setCampaignsLoading(true);
    campaignsApi.list()
      .then(setCampaigns)
      .catch(console.error)
      .finally(() => setCampaignsLoading(false));
  };

  const filtered = (filter === 'ALL' ? templates : templates.filter(t => t.channel === filter))
    .filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <Topbar title="Email Templates" />
      <main className="flex-1 flex overflow-hidden">

        {/* ── Left sidebar: list ── */}
        <div className="w-72 shrink-0 border-r border-gray-800 flex flex-col">
          {/* Filter tabs */}
          <div className="flex border-b border-gray-800">
            {(['ALL', 'EMAIL', 'LINKEDIN'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`flex-1 py-2.5 text-xs font-medium transition-colors ${filter === f ? 'text-brand-400 border-b-2 border-brand-500' : 'text-gray-500 hover:text-gray-300'}`}>
                {f === 'ALL' ? 'All' : f}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="px-3 pt-3 pb-1">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search templates..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-gray-800/60 border border-gray-700/50 rounded-lg text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* New template button */}
          <button
            onClick={() => { setSelected(null); setCreating(true); setForm({ name: '', subject: '', body: '', channel: 'EMAIL' }); }}
            className="mx-3 mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-500/10 border border-brand-500/20 text-brand-400 hover:bg-brand-500/20 transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            New Template
          </button>

          <div className="flex-1 overflow-y-auto py-2 px-3 space-y-1">
            {/* My templates */}
            {loading ? (
              <div className="space-y-2 mt-2">
                {[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-gray-800/60 rounded-lg animate-pulse" />)}
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-gray-600 text-center mt-4">
                {search ? 'No templates match your search' : 'No saved templates'}
              </p>
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
                    {' · '}{new Date(t.updatedAt).toLocaleDateString('en', { day: '2-digit', month: 'short' })}
                  </p>
                  <p className="text-[11px] text-gray-700 mt-0.5 truncate">{stripHtml(t.body).slice(0, 60)}</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
                  className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all p-0.5 shrink-0 mt-0.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}

            {/* Starter templates divider */}
            {!search && (
              <>
                <div className="pt-3 pb-1">
                  <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider px-1">Starter Templates</p>
                </div>
                {STARTERS.filter(s => filter === 'ALL' || s.channel === filter).map((s, i) => (
                  <div key={i} onClick={() => handleStarterUse(s)}
                    className="flex items-start gap-2 p-3 rounded-lg cursor-pointer hover:bg-gray-800/50 transition-colors border border-gray-800/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-400 truncate">{s.name}</p>
                      <p className={`text-xs mt-0.5 ${s.channel === 'EMAIL' ? 'text-brand-500/70' : 'text-blue-500/70'}`}>{s.channel}</p>
                      <p className="text-[11px] text-gray-700 mt-0.5 truncate">{stripHtml(s.body).slice(0, 55)}</p>
                    </div>
                    <span className="text-[10px] text-gray-600 shrink-0 mt-1">use →</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* ── Right: preview or editor ── */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          {!creating && !selected ? (
            <div className="h-full flex items-center justify-center text-center px-8">
              <div>
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-500 text-sm">Select a template or create a new one</p>
                <p className="text-gray-700 text-xs mt-1">Templates let you quickly insert ready-made messages into campaigns</p>
              </div>
            </div>
          ) : !creating && selected ? (
            <TemplatePreview
              template={selected}
              onEdit={handleEdit}
              onUseCampaign={() => handleOpenCampaignPicker(selected)}
            />
          ) : (
            <div className="p-6 space-y-5 max-w-3xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">
                  {selected ? 'Edit Template' : 'New Template'}
                </h2>
                <div className="flex gap-2">
                  <button onClick={() => { setCreating(false); if (!selected) setSelected(null); }}
                    className="text-sm text-gray-500 hover:text-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleSave} disabled={saving || !form.name || !form.body}
                    className="text-sm bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg transition-colors font-medium">
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>

              {/* Name + Channel */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1 block">Template Name</label>
                  <input
                    className="block w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    placeholder="Cold Introduction, Follow-up #1..."
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="w-36">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1 block">Channel</label>
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
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1 block">Subject Line</label>
                  <input
                    className="block w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    placeholder="Subject — you can use {{firstName}}, {{company}}"
                    value={form.subject}
                    onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  />
                </div>
              )}

              {/* Body */}
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1 block">Body</label>
                <EmailEditor
                  value={form.body}
                  onChange={html => setForm(f => ({ ...f, body: html }))}
                  placeholder="Write your message. Use variable buttons above to personalize."
                  minHeight={280}
                />
              </div>

              <div className="bg-gray-800/40 rounded-lg px-4 py-3 text-xs text-gray-500 leading-relaxed">
                Use{' '}
                {['{{firstName}}', '{{company}}', '{{title}}'].map(v => (
                  <code key={v} className="text-indigo-400 bg-indigo-900/30 px-1 rounded mx-0.5">{v}</code>
                ))}{' '}
                and other variables — they will be replaced with real lead data when sending.
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── Campaign Picker Modal ── */}
      <Modal
        open={showCampaignPicker}
        onClose={() => setShowCampaignPicker(false)}
        title={`Use "${templateForCampaign?.name}" in Campaign`}
        size="sm"
      >
        <div className="space-y-3">
          <p className="text-xs text-gray-500">Select a campaign to add this template as a sequence step.</p>
          {campaignsLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-gray-800/60 rounded-lg animate-pulse" />)}
            </div>
          ) : campaigns.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No campaigns found. Create a campaign first.</p>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {campaigns.map(c => (
                <button
                  key={c.id}
                  onClick={() => {
                    window.location.href = `/campaigns/${c.id}?addTemplate=${templateForCampaign?.id}`;
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-gray-800/60 hover:bg-gray-800 border border-gray-700/50 hover:border-brand-500/30 transition-colors text-left"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-200">{c.name}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{c.status} · {c.channel}</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => setShowCampaignPicker(false)}
            className="w-full text-sm text-gray-500 hover:text-gray-300 py-2 transition-colors"
          >
            Cancel
          </button>
        </div>
      </Modal>
    </>
  );
}
