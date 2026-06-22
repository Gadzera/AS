'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Grid,
  Mail,
  Plus,
  Settings2,
  Upload,
  Users,
  X,
} from 'lucide-react';

import { leadsApi, campaignsApi } from '@/lib/api';
import api from '@/lib/api';
import type { Lead, Campaign } from '@/types';
import { SelectionProvider, useSelection } from '@/lib/selection';

import Topbar from '@/components/layout/Topbar';
import { ViewTabsRow } from '@/components/layout/PageHeader';
import BulkActionFooter from '@/components/layout/BulkActionFooter';
import Button from '@/components/ui/Button';
import FilterChip from '@/components/ui/FilterChip';
import Modal from '@/components/ui/Modal';

import LeadsTable from '@/components/leads/LeadsTable';
import LeadFilters, { type LeadsQuery } from '@/components/leads/LeadFilters';
import EmptyLeadsState from '@/components/leads/EmptyLeadsState';

const DEFAULT_QUERY: LeadsQuery = {
  sortField: 'score',
  sortDir: 'desc',
  status: '',
  industry: '',
};

export default function LeadsPage() {
  return (
    <SelectionProvider>
      <LeadsPageInner />
    </SelectionProvider>
  );
}

function LeadsPageInner() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState<LeadsQuery>(DEFAULT_QUERY);

  const [importOpen, setImportOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false); // M11-7: модалка bulk-enroll в кампанию
  const [toast, setToast] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await leadsApi.list({
        page: 1,
        limit: 200,
        status: query.status || undefined,
        industry: query.industry || undefined,
      });
      const sorted = sortLeads(res.leads, query);
      setLeads(sorted);
      setTotal(res.total);
    } catch (err) {
      console.error('Failed to fetch leads:', err);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const reload = () => fetchLeads();

  const isEmpty = !loading && total === 0;

  return (
    <>
      <Topbar
        title="Leads"
        icon={<Users size={16} strokeWidth={1.75} />}
        actions={<TopbarActions onAddToCampaign={() => setEnrollOpen(true)} />}
      />

      <ViewTabsRow
        left={[
          <FilterChip
            key="all"
            icon={<Grid size={12} strokeWidth={1.75} />}
            label="All Leads"
            active
          />,
          <FilterChip
            key="view"
            icon={<Settings2 size={12} strokeWidth={1.75} />}
            label="View settings"
          />,
        ]}
        right={[
          <Button
            key="import"
            size="sm"
            variant="secondary"
            onClick={() => setImportOpen(true)}
          >
            <Upload size={14} strokeWidth={1.75} />
            Import / Export
          </Button>,
          <Button
            key="new"
            size="sm"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={14} strokeWidth={1.75} />
            New Lead
          </Button>,
        ]}
      />

      <LeadFilters query={query} onChange={setQuery} />

      {isEmpty ? (
        <EmptyLeadsState
          onAdd={() => setCreateOpen(true)}
          onImport={() => setImportOpen(true)}
        />
      ) : (
        <LeadsTable
          leads={leads}
          total={total}
          loading={loading}
          query={query}
          onQueryChange={setQuery}
        />
      )}

      <LeadsBulkFooter
        onAddToCampaign={() => setEnrollOpen(true)}
        onSendEmail={() => setToast('Compose flow not yet wired')}
        onAddToList={() => setToast('Lists not yet available')}
        onRunWorkflow={() => setToast('Workflows not yet available')}
        onDelete={async (ids) => {
          try {
            await Promise.all(ids.map((id) => leadsApi.delete(id)));
            setToast(`Deleted ${ids.length} lead${ids.length === 1 ? '' : 's'}`);
            reload();
          } catch {
            setToast('Delete failed');
          }
        }}
      />

      <ImportLeadsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(n) => {
          setToast(`Imported ${n} leads`);
          reload();
        }}
      />

      <CreateLeadModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setToast('Lead created');
          reload();
        }}
      />

      <EnrollToCampaignModal
        open={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        onDone={(msg) => { setToast(msg); reload(); }}
      />

      {toast && <PageToast message={toast} onClose={() => setToast(null)} />}
    </>
  );
}

/* ----------------------------- helpers ----------------------------- */

function sortLeads(leads: Lead[], q: LeadsQuery): Lead[] {
  const dir = q.sortDir === 'desc' ? -1 : 1;
  const sorted = [...leads];
  sorted.sort((a, b) => {
    switch (q.sortField) {
      case 'score':
        return (a.score - b.score) * dir;
      case 'createdAt':
        return (
          (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir
        );
      case 'name': {
        const an = `${a.firstName} ${a.lastName}`.toLowerCase();
        const bn = `${b.firstName} ${b.lastName}`.toLowerCase();
        return an.localeCompare(bn) * dir;
      }
      default:
        return 0;
    }
  });
  return sorted;
}

/* ----------------------------- Bulk footer bridge ----------------------------- */

function LeadsBulkFooter({
  onAddToCampaign,
  onSendEmail,
  onAddToList,
  onRunWorkflow,
  onDelete,
}: {
  onAddToCampaign: () => void;
  onSendEmail: () => void;
  onAddToList: () => void;
  onRunWorkflow: () => void;
  onDelete: (ids: string[]) => Promise<void> | void;
}) {
  const { selected, count, clear } = useSelection();
  return (
    <BulkActionFooter
      count={count}
      onClose={clear}
      actions={[
        {
          icon: <Plus size={14} strokeWidth={1.75} />,
          label: 'Add to campaign',
          onClick: onAddToCampaign,
        },
        {
          icon: <Plus size={14} strokeWidth={1.75} />,
          label: 'Add to list',
          onClick: onAddToList,
        },
        {
          icon: <Mail size={14} strokeWidth={1.75} />,
          label: 'Send email',
          onClick: onSendEmail,
        },
        {
          label: 'Run workflow',
          onClick: onRunWorkflow,
        },
        {
          label: 'Delete',
          separator: true,
          danger: true,
          onClick: async () => {
            const ids = Array.from(selected);
            await onDelete(ids);
            clear();
          },
        },
      ]}
    />
  );
}

/* ----------------------------- Topbar actions ----------------------------- */

function TopbarActions({ onAddToCampaign }: { onAddToCampaign: () => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <Button size="sm" variant="secondary" onClick={onAddToCampaign}>
        <Plus size={14} strokeWidth={1.75} />
        Add to campaign
      </Button>
      <Button size="sm">
        <Mail size={14} strokeWidth={1.75} />
        Compose email
      </Button>
    </div>
  );
}

/* ----------------------------- Bulk enroll to campaign (M11-7) ----------------------------- */

function EnrollToCampaignModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const { selected, clear } = useSelection();
  const ids = Array.from(selected);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ enrolled: number; skipped: number } | null>(null);

  useEffect(() => {
    if (!open) { setResult(null); return; }
    campaignsApi.list().then((cs) => {
      setCampaigns(cs);
      if (cs.length && !campaignId) setCampaignId(cs[0].id);
    }).catch(() => undefined);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function enroll() {
    if (!campaignId || ids.length === 0) return;
    setBusy(true);
    try {
      const r = await leadsApi.enrollBulk(campaignId, ids);
      setResult({ enrolled: r.enrolled, skipped: r.skipped.length });
      const dup = r.skipped.filter((s) => s.reason === 'already_enrolled').length;
      onDone(`Enrolled ${r.enrolled} of ${r.requested}${dup ? ` · ${dup} already in campaign` : ''}`);
      clear();
    } catch {
      onDone('Bulk enroll failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add leads to a campaign">
      <div className="space-y-3">
        <p className="text-[12.5px] text-ink-muted">
          {ids.length > 0
            ? <><b className="text-ink">{ids.length}</b> selected lead{ids.length === 1 ? '' : 's'} will be enrolled. Leads already in the campaign are skipped (no duplicates).</>
            : 'Select one or more leads first, then choose a campaign.'}
        </p>
        <label className="block text-[12px] font-semibold text-ink-muted">Campaign
          <select
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink focus:border-brand-400 focus:outline-none"
          >
            {campaigns.length === 0 && <option value="">No campaigns yet</option>}
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.status}</option>)}
          </select>
        </label>
        {result && (
          <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-[12.5px] text-emerald-700">
            Enrolled {result.enrolled}{result.skipped ? ` · skipped ${result.skipped} (already enrolled / invalid)` : ''}.
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button size="sm" variant="secondary" onClick={onClose}>Close</Button>
          <Button size="sm" onClick={enroll} disabled={busy || !campaignId || ids.length === 0}>
            {busy ? 'Enrolling…' : `Enroll ${ids.length || ''} lead${ids.length === 1 ? '' : 's'}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ----------------------------- Import modal ----------------------------- */

function ImportLeadsModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: (count: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);

  const reset = () => {
    setBusy(false);
    setError(null);
    setFileName(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFile = async (file: File) => {
    setBusy(true);
    setError(null);
    setResult(null);
    setFileName(file.name);
    try {
      const text = await file.text();
      const res = await api.post<{ imported: number; skipped: number }>(
        '/leads/import',
        { csvContent: text },
      );
      setResult(res.data);
      onImported(res.data.imported);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Import leads from CSV"
      size="lg"
    >
      <div className="space-y-4">
        <p className="text-[13.5px] text-[var(--text-muted)] leading-5">
          Upload a CSV file. Common headers like{' '}
          <code className="px-1 py-0.5 rounded bg-[var(--surface-2)] text-[12px]">
            firstName
          </code>
          ,{' '}
          <code className="px-1 py-0.5 rounded bg-[var(--surface-2)] text-[12px]">
            email
          </code>
          ,{' '}
          <code className="px-1 py-0.5 rounded bg-[var(--surface-2)] text-[12px]">
            company
          </code>{' '}
          are detected automatically.
        </p>

        <label
          className={[
            'flex flex-col items-center justify-center gap-2 h-32 rounded-lg border-2 border-dashed cursor-pointer transition-colors',
            busy
              ? 'border-[var(--border-strong)] bg-[var(--surface-2)] cursor-wait'
              : 'border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--border-strong)]',
          ].join(' ')}
        >
          <Upload size={20} strokeWidth={1.75} className="text-[var(--text-subtle)]" />
          <span className="text-[13.5px] text-[var(--text)] font-medium">
            {fileName ?? 'Click to select a CSV file'}
          </span>
          <span className="text-[12px] text-[var(--text-subtle)]">
            Max ~10MB. UTF-8 recommended.
          </span>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </label>

        {result && (
          <div
            className="text-[13.5px] text-[var(--success)] bg-[var(--success-soft)] rounded-md px-3 py-2"
          >
            Imported {result.imported} leads
            {result.skipped > 0 ? `, ${result.skipped} skipped (duplicates or errors)` : ''}.
          </div>
        )}

        {error && (
          <div
            className="text-[13.5px] text-[var(--danger)] bg-[var(--danger-soft)] rounded-md px-3 py-2"
          >
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)] -mx-5 px-5">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Close
          </Button>
          <Button
            size="sm"
            onClick={() => inputRef.current?.click()}
            loading={busy}
          >
            {result ? 'Import another' : 'Choose file'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ----------------------------- Create lead modal ----------------------------- */

interface CreateForm {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  title: string;
  industry: string;
  country: string;
  city: string;
}

const EMPTY_CREATE: CreateForm = {
  firstName: '',
  lastName: '',
  email: '',
  company: '',
  title: '',
  industry: '',
  country: '',
  city: '',
};

function CreateLeadModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<CreateForm>(EMPTY_CREATE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError('First and last name are required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await leadsApi.create({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim() || undefined,
        company: form.company.trim() || undefined,
        title: form.title.trim() || undefined,
        industry: form.industry.trim() || undefined,
        country: form.country.trim() || undefined,
      });
      setForm(EMPTY_CREATE);
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to create lead');
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setForm(EMPTY_CREATE);
    setError(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={close} title="New lead" size="lg">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="First name"
            value={form.firstName}
            onChange={(v) => setForm({ ...form, firstName: v })}
            autoFocus
          />
          <FormField
            label="Last name"
            value={form.lastName}
            onChange={(v) => setForm({ ...form, lastName: v })}
          />
        </div>
        <FormField
          label="Email"
          type="email"
          value={form.email}
          onChange={(v) => setForm({ ...form, email: v })}
        />
        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="Company"
            value={form.company}
            onChange={(v) => setForm({ ...form, company: v })}
          />
          <FormField
            label="Title"
            value={form.title}
            onChange={(v) => setForm({ ...form, title: v })}
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <FormField
            label="Industry"
            value={form.industry}
            onChange={(v) => setForm({ ...form, industry: v })}
          />
          <FormField
            label="Country"
            value={form.country}
            onChange={(v) => setForm({ ...form, country: v })}
          />
          <FormField
            label="City"
            value={form.city}
            onChange={(v) => setForm({ ...form, city: v })}
          />
        </div>

        {error && (
          <div className="text-[13px] text-[var(--danger)] bg-[var(--danger-soft)] rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)] -mx-5 px-5">
          <Button variant="secondary" size="sm" onClick={close}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} loading={busy}>
            Create lead
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function FormField({
  label,
  value,
  onChange,
  type = 'text',
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        className="h-8 px-2.5 text-[13.5px] text-[var(--text)] bg-[var(--surface)] border border-[var(--border)] rounded-md focus:outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_rgba(79,70,229,0.15)] transition-shadow duration-100"
      />
    </label>
  );
}

/* ----------------------------- Toast ----------------------------- */

function PageToast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 h-10 px-3 rounded-lg bg-[var(--surface)] border border-[var(--border)]"
      style={{ boxShadow: 'var(--shadow-popover)' }}
      role="status"
    >
      <span className="text-[13px] text-[var(--text)]">{message}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss"
        className="w-6 h-6 inline-flex items-center justify-center rounded-md text-[var(--text-subtle)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors duration-100"
      >
        <X size={12} strokeWidth={1.75} />
      </button>
    </div>
  );
}
