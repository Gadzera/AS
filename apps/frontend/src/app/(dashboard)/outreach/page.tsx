'use client';

import { useEffect, useState } from 'react';
import { leadsApi, campaignsApi, outreachApi } from '@/lib/api';
import type { Lead, Campaign, GeneratedOutreach } from '@/types';
import Topbar from '@/components/layout/Topbar';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

export default function OutreachPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [language, setLanguage] = useState<'en' | 'ru' | 'de'>('en');
  const [tone, setTone] = useState<'professional' | 'casual' | 'friendly'>('professional');
  const [senderName, setSenderName] = useState('');
  const [senderTitle, setSenderTitle] = useState('');
  const [senderCompany, setSenderCompany] = useState('');
  const [valueProposition, setValueProposition] = useState('');

  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GeneratedOutreach | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Promise.all([
      leadsApi.list({ limit: 100 }),
      campaignsApi.list(),
    ]).then(([leadsRes, campaignsRes]) => {
      setLeads(leadsRes.leads);
      setCampaigns(campaignsRes);
    }).catch(console.error);
  }, []);

  const handleGenerate = async () => {
    if (!selectedLeadId) return;
    setError('');
    setResult(null);
    setGenerating(true);

    try {
      const res = await outreachApi.generate({
        leadId: selectedLeadId,
        campaignId: selectedCampaignId || undefined,
        language,
        tone,
        senderName: senderName || undefined,
        senderTitle: senderTitle || undefined,
        senderCompany: senderCompany || undefined,
        valueProposition: valueProposition || undefined,
      });
      setResult(res);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Failed to generate message. Check your API key in settings.';
      setError(msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    const text = result.subject ? `Subject: ${result.subject}\n\n${result.body}` : result.body;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const selectedLead = leads.find((l) => l.id === selectedLeadId);

  return (
    <>
      <Topbar title="Outreach Writer" />
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Config */}
          <div className="space-y-4">
            <Card padding="md">
              <h2 className="font-semibold text-white mb-4">Message Settings</h2>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Select Lead *</label>
                  <select
                    className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/70"
                    value={selectedLeadId}
                    onChange={(e) => setSelectedLeadId(e.target.value)}
                  >
                    <option value="">Choose a lead...</option>
                    {leads.map((lead) => (
                      <option key={lead.id} value={lead.id}>
                        {lead.firstName} {lead.lastName}
                        {lead.company ? ` — ${lead.company}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Campaign (optional)</label>
                  <select
                    className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/70"
                    value={selectedCampaignId}
                    onChange={(e) => setSelectedCampaignId(e.target.value)}
                  >
                    <option value="">No campaign</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Language</label>
                    <select
                      className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/70"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value as 'en' | 'ru' | 'de')}
                    >
                      <option value="en">English</option>
                      <option value="ru">Russian</option>
                      <option value="de">German</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Tone</label>
                    <select
                      className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/70"
                      value={tone}
                      onChange={(e) => setTone(e.target.value as typeof tone)}
                    >
                      <option value="professional">Professional</option>
                      <option value="casual">Casual</option>
                      <option value="friendly">Friendly</option>
                    </select>
                  </div>
                </div>
              </div>
            </Card>

            <Card padding="md">
              <h2 className="font-semibold text-white mb-4">Your Info (optional)</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Your name</label>
                  <input
                    className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/70"
                    placeholder="Jane Smith"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Your title</label>
                  <input
                    className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/70"
                    placeholder="VP Sales, Acme Inc."
                    value={senderTitle}
                    onChange={(e) => setSenderTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Your company</label>
                  <input
                    className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/70"
                    placeholder="Acme Inc."
                    value={senderCompany}
                    onChange={(e) => setSenderCompany(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Value proposition</label>
                  <textarea
                    className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/70"
                    rows={3}
                    placeholder="We help SaaS companies increase reply rates by 3x..."
                    value={valueProposition}
                    onChange={(e) => setValueProposition(e.target.value)}
                  />
                </div>
              </div>
            </Card>

            <Button
              className="w-full"
              size="lg"
              onClick={handleGenerate}
              loading={generating}
              disabled={!selectedLeadId}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Generate Message
            </Button>
          </div>

          {/* Right: Result */}
          <div>
            {/* Lead preview */}
            {selectedLead && (
              <Card padding="md" className="mb-4">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Writing for:</h3>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-500/10 text-brand-400 rounded-full flex items-center justify-center font-bold">
                    {selectedLead.firstName.charAt(0)}{selectedLead.lastName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-white">
                      {selectedLead.firstName} {selectedLead.lastName}
                    </p>
                    <p className="text-sm text-gray-500">
                      {selectedLead.title}{selectedLead.company ? ` · ${selectedLead.company}` : ''}
                    </p>
                  </div>
                </div>
              </Card>
            )}

            <Card padding="md">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-white">Generated Message</h2>
                {result && (
                  <Button size="sm" variant="secondary" onClick={handleCopy}>
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                )}
              </div>

              {generating && (
                <div className="py-16 text-center">
                  <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full mx-auto mb-4" />
                  <p className="text-gray-500 text-sm">Writing your personalized message...</p>
                </div>
              )}

              {error && !generating && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                  {error}
                </div>
              )}

              {result && !generating && (
                <div className="space-y-4">
                  {result.subject && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</label>
                      <div className="mt-1.5 p-3 bg-gray-800/60 border border-gray-700/60 rounded-lg text-sm font-medium text-gray-200">
                        {result.subject}
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Body</label>
                    <textarea
                      className="mt-1 w-full border border-gray-700 bg-gray-900 rounded-lg p-3 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/70 resize-none"
                      rows={16}
                      value={result.body}
                      onChange={(e) => setResult({ ...result, body: e.target.value })}
                    />
                  </div>
                  <Button variant="secondary" onClick={handleGenerate} className="w-full">
                    Regenerate
                  </Button>
                </div>
              )}

              {!result && !generating && !error && (
                <div className="py-16 text-center text-gray-400">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <p className="text-sm">Select a lead and click Generate to write a personalized message</p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
