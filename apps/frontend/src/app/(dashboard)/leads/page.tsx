'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { leadsApi, outreachApi, campaignsApi } from '@/lib/api';
import { api } from '@/lib/api';
import type { Lead, LeadStatus, Campaign } from '@/types';
import Topbar from '@/components/layout/Topbar';
import PageTransition from '@/components/layout/PageTransition';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import LeadsTable from '@/components/leads/LeadsTable';
import Modal from '@/components/ui/Modal';
import { LeadStatusBadge, ScoreBadge } from '@/components/ui/Badge';
import TagManager from '@/components/ui/TagManager';
import { useToast } from '@/components/ui/Toast';

const STATUS_OPTIONS: LeadStatus[] = [
  'NEW', 'CONTACTED', 'REPLIED', 'HOT', 'CONVERTED', 'LOST', 'UNSUBSCRIBED',
];

// ─── Lead Detail Drawer ───────────────────────────────────────────────────────

function LeadDrawer({
  lead,
  onClose,
  onSaved,
  onRefresh,
}: {
  lead: Lead | null;
  onClose: () => void;
  onSaved: (updated: Lead) => void;
  onRefresh: () => void;
}) {
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (lead) setNotes(lead.notes ?? '');
  }, [lead]);

  const handleNotesSave = async () => {
    if (!lead) return;
    setSaving(true);
    try {
      const updated = await leadsApi.update(lead.id, { notes });
      onSaved(updated);
    } catch {
      // silently ignore
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {lead && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
          />
          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 350, damping: 35 }}
            className="fixed inset-y-0 right-0 w-96 bg-gray-900 border-l border-gray-800 shadow-2xl z-50 flex flex-col overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
              <h2 className="text-sm font-semibold text-white">Lead Details</h2>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 px-6 py-5 space-y-5">
              {/* Avatar + name */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-500/30 to-purple-500/30 text-brand-400 border border-brand-500/20 flex items-center justify-center text-lg font-bold shrink-0">
                  {lead.firstName?.[0] ?? ''}{lead.lastName?.[0] ?? ''}
                </div>
                <div>
                  <h3 className="font-semibold text-white">{lead.firstName} {lead.lastName}</h3>
                  {lead.title && <p className="text-xs text-gray-500">{lead.title}</p>}
                </div>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2">
                <LeadStatusBadge status={lead.status} />
                <ScoreBadge score={lead.score} />
              </div>

              {/* Info grid */}
              <div className="space-y-2.5">
                {lead.email && (
                  <DrawerField label="Email">
                    <a href={`mailto:${lead.email}`} className="text-brand-400 hover:underline text-sm truncate">
                      {lead.email}
                    </a>
                  </DrawerField>
                )}
                {lead.company && (
                  <DrawerField label="Company">
                    <span className="text-sm text-gray-200">{lead.company}</span>
                    {lead.companySize && <span className="text-xs text-gray-500 ml-1.5">({lead.companySize} emp.)</span>}
                  </DrawerField>
                )}
                {lead.industry && (
                  <DrawerField label="Industry">
                    <span className="text-sm text-gray-300">{lead.industry}</span>
                  </DrawerField>
                )}
                {(lead.city || lead.country) && (
                  <DrawerField label="Location">
                    <span className="text-sm text-gray-300">
                      {[lead.city, lead.country].filter(Boolean).join(', ')}
                    </span>
                  </DrawerField>
                )}
                {lead.website && (
                  <DrawerField label="Website">
                    <a
                      href={lead.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-400 hover:underline text-sm truncate"
                    >
                      {lead.website}
                    </a>
                  </DrawerField>
                )}
                {lead.linkedinUrl && (
                  <DrawerField label="LinkedIn">
                    <a
                      href={lead.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-400 hover:underline text-sm truncate"
                    >
                      View profile
                    </a>
                  </DrawerField>
                )}
                <DrawerField label="Source">
                  <span className="text-sm text-gray-400 capitalize">{lead.source ?? 'manual'}</span>
                </DrawerField>
                <DrawerField label="Added">
                  <span className="text-sm text-gray-400">
                    {new Date(lead.createdAt).toLocaleDateString()}
                  </span>
                </DrawerField>
              </div>

              {/* Tags */}
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-1.5">Tags</label>
                <TagManager
                  leadId={lead.id}
                  currentTags={lead.tags ?? []}
                  onUpdate={onRefresh}
                />
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Notes</label>
                <textarea
                  className="mt-1.5 w-full border border-gray-700 bg-gray-800/60 rounded-lg p-3 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/70 resize-none"
                  rows={5}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={handleNotesSave}
                  placeholder="Add notes about this lead..."
                />
                {saving && <p className="text-xs text-gray-600 mt-1">Saving...</p>}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function DrawerField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-gray-600 w-20 shrink-0 pt-0.5">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

// ─── CSV Import Modal ─────────────────────────────────────────────────────────

function ImportModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setError('Please select a CSV file.');
      return;
    }
    setImporting(true);
    setError('');
    setResult(null);
    try {
      const text = await file.text();
      const res = await api.post<{ imported: number; skipped: number }>('/leads/import', { csvContent: text });
      setResult(res.data);
      onImported();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Import failed. Check your CSV format.');
    } finally {
      setImporting(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    setResult(null);
    setError('');
    setDragging(false);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Import CSV" size="md">
      <div className="space-y-4">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            dragging
              ? 'border-brand-500 bg-brand-500/5'
              : 'border-gray-700 hover:border-brand-500/60 hover:bg-gray-800/40'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileChange}
          />
          {importing ? (
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
              <p className="text-sm text-gray-400">Importing...</p>
            </div>
          ) : (
            <>
              <svg className="w-10 h-10 mx-auto mb-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm font-medium text-gray-300 mb-1">
                {dragging ? 'Drop your CSV here' : 'Drag & drop a CSV file here'}
              </p>
              <p className="text-xs text-gray-600">or click to browse</p>
            </>
          )}
        </div>

        {error && (
          <div className="p-3 bg-red-900/20 border border-red-800/60 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}

        {result && (
          <div className="p-3 bg-green-900/20 border border-green-800/60 rounded-lg text-sm text-green-400">
            Imported {result.imported} leads
            {result.skipped > 0 ? `, ${result.skipped} skipped (duplicates/errors)` : ''}
          </div>
        )}

        <p className="text-xs text-gray-600">
          Expected columns: firstName, lastName, email, company, title, industry, country, city, website
        </p>
      </div>
    </Modal>
  );
}

// ─── Bulk Actions Toolbar ─────────────────────────────────────────────────────

function BulkToolbar({
  selectedIds,
  onDelete,
  onAddToCampaign,
  onExport,
  onClear,
}: {
  selectedIds: string[];
  onDelete: () => void;
  onAddToCampaign: () => void;
  onExport: () => void;
  onClear: () => void;
}) {
  if (selectedIds.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 bg-gray-900 border border-gray-700/80 rounded-2xl shadow-2xl"
    >
      <span className="text-sm text-gray-300 font-medium mr-1">
        {selectedIds.length} lead{selectedIds.length !== 1 ? 's' : ''} selected
      </span>
      <div className="w-px h-5 bg-gray-700" />
      <Button size="sm" variant="secondary" onClick={onAddToCampaign}>
        Add to Campaign
      </Button>
      <Button size="sm" variant="secondary" onClick={onExport}>
        Export Selected
      </Button>
      <Button size="sm" variant="danger" onClick={onDelete}>
        Delete
      </Button>
      <button
        onClick={onClear}
        className="p-1 text-gray-500 hover:text-gray-300 transition-colors ml-1"
        title="Clear selection"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </motion.div>
  );
}

// ─── Campaign Picker Modal ────────────────────────────────────────────────────

function CampaignPickerModal({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (campaignId: string) => void;
}) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    campaignsApi.list().then(setCampaigns).catch(() => {}).finally(() => setLoading(false));
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Add to Campaign" size="sm">
      {loading ? (
        <div className="py-6 text-center text-gray-500 text-sm">Loading campaigns...</div>
      ) : campaigns.length === 0 ? (
        <div className="py-6 text-center text-gray-500 text-sm">No campaigns found. Create one first.</div>
      ) : (
        <ul className="divide-y divide-gray-800">
          {campaigns.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => { onPick(c.id); onClose(); }}
                className="w-full text-left px-3 py-3 text-sm text-gray-200 hover:bg-gray-800/60 transition-colors rounded-lg"
              >
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{c.channel} · {c.status}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LeadsPage() {
  const { error: toastError } = useToast();
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
  const [sortBy, setSortBy] = useState('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals / drawers
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [drawerLead, setDrawerLead] = useState<Lead | null>(null);
  const [outreachLead, setOutreachLead] = useState<Lead | null>(null);
  const [outreachText, setOutreachText] = useState('');
  const [outreachSubject, setOutreachSubject] = useState('');
  const [generatingOutreach, setGeneratingOutreach] = useState(false);
  const [campaignPickerOpen, setCampaignPickerOpen] = useState(false);
  const [addToCampaignLead, setAddToCampaignLead] = useState<Lead | null>(null);

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
        sortBy: sortBy || undefined,
        sortDir: sortDir || undefined,
      });
      setLeads(res.leads);
      setTotal(res.total);
      setPages(res.pages);
    } catch (err) {
      console.error('Failed to fetch leads:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, status, country, industry, sortBy, sortDir]);

  useEffect(() => {
    const timer = setTimeout(fetchLeads, 300);
    return () => clearTimeout(timer);
  }, [fetchLeads]);

  const handleSortChange = (field: string, dir: 'asc' | 'desc') => {
    setSortBy(field);
    setSortDir(dir);
    setPage(1);
  };

  const handleSelectionChange = useCallback((ids: string[]) => {
    setSelectedIds(ids);
  }, []);

  const handleGenerateOutreach = async (lead: Lead) => {
    setOutreachLead(lead);
    setOutreachText('');
    setOutreachSubject('');
    setGeneratingOutreach(true);
    try {
      const result = await outreachApi.generate({ leadId: lead.id, language: 'en', tone: 'professional' });
      setOutreachText(result.body);
      setOutreachSubject(result.subject);
    } catch (err) {
      console.error('Failed to generate outreach:', err);
      setOutreachText('Failed to generate message. Check your API key in settings.');
    } finally {
      setGeneratingOutreach(false);
    }
  };

  // CSV Export
  const handleExport = async (ids?: string[]) => {
    try {
      const params: { ids?: string[]; status?: string; search?: string } = {};
      if (ids && ids.length > 0) {
        params.ids = ids;
      } else {
        if (status) params.status = status;
        if (search) params.search = search;
      }
      const res = await leadsApi.export(params);
      const blob = new Blob([res.data as BlobPart], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'leads.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Delete ${selectedIds.length} lead${selectedIds.length !== 1 ? 's' : ''}? This cannot be undone.`)) return;
    try {
      await leadsApi.bulkDelete(selectedIds);
      setSelectedIds([]);
      fetchLeads();
    } catch (err: any) {
      toastError(err?.response?.data?.error ?? 'Failed to delete leads');
    }
  };

  // Add selection to campaign
  const handleAddSelectionToCampaign = (campaignId: string) => {
    api.post('/leads/bulk', { action: 'add-to-campaign', leadIds: selectedIds, campaignId })
      .then(() => { setSelectedIds([]); })
      .catch((err: any) => toastError(err?.response?.data?.error ?? 'Failed to add leads to campaign'));
  };

  // Single lead add to campaign
  const handleAddToCampaign = (lead: Lead) => {
    setAddToCampaignLead(lead);
    setCampaignPickerOpen(true);
  };

  const handleSingleAddToCampaign = (campaignId: string) => {
    if (!addToCampaignLead) return;
    api.post('/leads/bulk', { action: 'add-to-campaign', leadIds: [addToCampaignLead.id], campaignId })
      .catch((err: any) => toastError(err?.response?.data?.error ?? 'Failed to add lead to campaign'));
    setAddToCampaignLead(null);
  };

  return (
    <>
      <Topbar title="Leads" />
      <PageTransition>
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
            <Button
              variant="secondary"
              onClick={() => handleExport(selectedIds.length > 0 ? selectedIds : undefined)}
            >
              Export CSV
            </Button>
            <Button onClick={() => setImportModalOpen(true)}>
              Import CSV
            </Button>
          </div>
        </Card>

        {/* Table */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">
              {total} lead{total !== 1 ? 's' : ''}
            </h2>
          </div>

          <LeadsTable
            leads={leads}
            loading={loading}
            onGenerateOutreach={handleGenerateOutreach}
            onView={(lead) => setDrawerLead(lead)}
            onAddToCampaign={handleAddToCampaign}
            onSortChange={handleSortChange}
            onSelectionChange={handleSelectionChange}
            onRefresh={fetchLeads}
          />

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
        </Card>
      </main>
      </PageTransition>

      {/* Bulk actions toolbar */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <BulkToolbar
            selectedIds={selectedIds}
            onDelete={handleBulkDelete}
            onAddToCampaign={() => setCampaignPickerOpen(true)}
            onExport={() => handleExport(selectedIds)}
            onClear={() => setSelectedIds([])}
          />
        )}
      </AnimatePresence>

      {/* Import CSV modal */}
      <ImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImported={fetchLeads}
      />

      {/* Lead detail drawer */}
      <LeadDrawer
        lead={drawerLead}
        onClose={() => setDrawerLead(null)}
        onSaved={(updated) => {
          setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
          setDrawerLead(updated);
        }}
        onRefresh={fetchLeads}
      />

      {/* Campaign picker modal — for bulk or single */}
      <CampaignPickerModal
        open={campaignPickerOpen}
        onClose={() => { setCampaignPickerOpen(false); setAddToCampaignLead(null); }}
        onPick={(campaignId) => {
          if (addToCampaignLead) {
            handleSingleAddToCampaign(campaignId);
          } else {
            handleAddSelectionToCampaign(campaignId);
          }
        }}
      />

      {/* Outreach Modal */}
      <Modal
        open={!!outreachLead}
        onClose={() => setOutreachLead(null)}
        title={`Outreach — ${outreachLead?.firstName} ${outreachLead?.lastName}`}
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
                <div className="mt-1.5 p-3 bg-gray-800/60 border border-gray-700/60 rounded-lg text-sm text-gray-200">
                  {outreachSubject}
                </div>
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
              <Button onClick={() => { navigator.clipboard.writeText(outreachText); }}>
                Copy to clipboard
              </Button>
              {outreachLead && (
                <Button variant="secondary" onClick={() => handleGenerateOutreach(outreachLead)}>
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
