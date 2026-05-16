'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { leadsApi, outreachApi } from '@/lib/api';
import { api } from '@/lib/api';
import type { Lead, LeadStatus } from '@/types';
import Topbar from '@/components/layout/Topbar';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import LeadsTable from '@/components/leads/LeadsTable';
import Modal from '@/components/ui/Modal';

const STATUS_OPTIONS: LeadStatus[] = [
  'NEW', 'CONTACTED', 'REPLIED', 'HOT', 'CONVERTED', 'LOST', 'UNSUBSCRIBED',
];

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [country, setCountry] = useState('');
  const [industry, setIndustry] = useState('');

  // CSV import
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const res = await api.post<{ imported: number; skipped: number }>('/leads/import', { csvContent: text });
      setImportResult(res.data);
      fetchLeads();
    } catch (err: any) {
      alert(err?.response?.data?.error ?? 'Import failed');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Outreach modal
  const [outreachLead, setOutreachLead] = useState<Lead | null>(null);
  const [outreachText, setOutreachText] = useState('');
  const [outreachSubject, setOutreachSubject] = useState('');
  const [generatingOutreach, setGeneratingOutreach] = useState(false);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await leadsApi.list({
        page,
        limit: 25,
        search: search || undefined,
        status: status || undefined,
        country: country || undefined,
        industry: industry || undefined,
      });
      setLeads(res.leads);
      setTotal(res.total);
      setPages(res.pages);
    } catch (err) {
      console.error('Failed to fetch leads:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, status, country, industry]);

  useEffect(() => {
    const timer = setTimeout(fetchLeads, 300);
    return () => clearTimeout(timer);
  }, [fetchLeads]);

  const handleGenerateOutreach = async (lead: Lead) => {
    setOutreachLead(lead);
    setOutreachText('');
    setOutreachSubject('');
    setGeneratingOutreach(true);

    try {
      const result = await outreachApi.generate({
        leadId: lead.id,
        language: 'en',
        tone: 'professional',
      });
      setOutreachText(result.body);
      setOutreachSubject(result.subject);
    } catch (err) {
      console.error('Failed to generate outreach:', err);
      setOutreachText('Failed to generate message. Check your API key in settings.');
    } finally {
      setGeneratingOutreach(false);
    }
  };

  const handleEnrich = async (lead: Lead) => {
    try {
      const updated = await leadsApi.enrich(lead.id);
      setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    } catch (err) {
      console.error('Failed to enrich lead:', err);
    }
  };

  return (
    <>
      <Topbar title="Leads" />
      <main className="flex-1 p-6 overflow-y-auto">
        {/* Filters */}
        <Card className="mb-6" padding="md">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-48">
              <Input
                placeholder="Search by name, company, email..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <select
              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/70"
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
              ))}
            </select>
            <Input
              placeholder="Country"
              value={country}
              onChange={(e) => { setCountry(e.target.value); setPage(1); }}
              className="w-36"
            />
            <Input
              placeholder="Industry"
              value={industry}
              onChange={(e) => { setIndustry(e.target.value); setPage(1); }}
              className="w-40"
            />
            <Button variant="secondary" onClick={fetchLeads}>Refresh</Button>
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />
            <Button onClick={() => fileInputRef.current?.click()} loading={importing}>
              {importing ? 'Importing...' : '↑ Import CSV'}
            </Button>
          </div>
          {importResult && (
            <div className="mt-3 p-3 bg-green-900/20 border border-green-800 rounded-lg text-sm text-green-400">
              ✓ Imported {importResult.imported} leads{importResult.skipped > 0 ? `, ${importResult.skipped} skipped (duplicates/errors)` : ''}
            </div>
          )}
        </Card>

        {/* Table */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">
              {total} lead{total !== 1 ? 's' : ''}
            </h2>
          </div>

          {loading ? (
            <div className="animate-pulse">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-gray-100 last:border-0">
                  <div className="h-4 bg-gray-200 rounded w-32" />
                  <div className="h-4 bg-gray-200 rounded w-24" />
                  <div className="h-4 bg-gray-200 rounded w-40" />
                  <div className="h-4 bg-gray-200 rounded w-20" />
                  <div className="h-4 bg-gray-200 rounded w-16 ml-auto" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {!loading && leads.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <h3 className="text-sm font-semibold text-gray-900">No leads yet</h3>
                    <p className="text-sm text-gray-500 mt-1">Import leads via CSV or use Apollo search to get started.</p>
                  </div>
                  <Button onClick={() => fileInputRef.current?.click()}>Import CSV</Button>
                </div>
              )}
              {leads.length > 0 && (
                <LeadsTable
                  leads={leads}
                  onGenerateOutreach={handleGenerateOutreach}
                  onView={(lead) => window.open(`/leads/${lead.id}`, '_blank')}
                />
              )}

              {/* Pagination */}
              {pages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-800">
                  <p className="text-sm text-gray-500">
                    Page {page} of {pages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={page >= pages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </main>

      {/* AI Outreach Modal */}
      <Modal
        open={!!outreachLead}
        onClose={() => setOutreachLead(null)}
        title={`AI Outreach — ${outreachLead?.firstName} ${outreachLead?.lastName}`}
        size="xl"
      >
        {generatingOutreach ? (
          <div className="py-8 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-gray-500">Writing your personalized message...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {outreachSubject && (
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Subject</label>
                <div className="mt-1.5 p-3 bg-gray-800/60 border border-gray-700/60 rounded-lg text-sm text-gray-200">{outreachSubject}</div>
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Message</label>
              <textarea
                className="mt-1.5 w-full border border-gray-700 bg-gray-900 rounded-lg p-3 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/70 resize-none"
                rows={12}
                value={outreachText}
                onChange={(e) => setOutreachText(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(outreachText);
                }}
              >
                Copy to clipboard
              </Button>
              {outreachLead && (
                <Button
                  variant="secondary"
                  onClick={() => handleGenerateOutreach(outreachLead)}
                >
                  Regenerate
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
