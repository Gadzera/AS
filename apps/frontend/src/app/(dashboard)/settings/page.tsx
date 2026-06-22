'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  Settings as SettingsIcon,
  UserCircle,
  Building2,
  CreditCard,
  Mailbox as MailboxIcon,
  Plug,
  Users,
  Check,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  KeyRound,
  Monitor,
  Database,
  ChevronRight,
  Plus,
  Pause,
  Play,
  Trash2,
  Star,
  Save,
  Loader2,
  Clock,
  AlertTriangle,
  Copy,
  Ban,
  RotateCcw,
  ShieldAlert,
  History,
  Download,
} from 'lucide-react';
import { authApi, billingApi, teamApi, settingsApi, type TeamMember, type AuditEntry, type Workspace, type Mailbox, type MailboxSummary, type MailboxStatus, type MailboxProvider, type BillingOverview, type StripeWebhookEvent } from '@/lib/api';
import { getAiCreditBalance, listAiCreditTransactions, type AiCreditBalance, type AiCreditTransaction } from '@/lib/crmApi';
import { setStoredUser } from '@/lib/auth';
import type { User } from '@/types';
import Topbar from '@/components/layout/Topbar';
import PermissionsMatrix from '@/components/settings/PermissionsMatrix';
import TeamsManager from '@/components/settings/TeamsManager';
import AutomationGrants from '@/components/settings/AutomationGrants';
import SecuritySettings from '@/components/settings/SecuritySettings';
import AppearanceToggle from '@/components/settings/AppearanceToggle';
import WorkspaceGeneral from '@/components/settings/WorkspaceGeneral';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

const ROLE_TONE: Record<string, string> = { OWNER: 'bg-brand-100 text-brand-700', ADMIN: 'bg-violet-100 text-violet-700', MEMBER: 'bg-surface-2 text-ink-muted' };

const REASON_LABEL: Record<string, string> = {
  AI_RESEARCH: 'Research', AI_SUMMARIZE: 'Summarize', AI_CLASSIFY: 'Classify', AI_PROMPT: 'Prompt',
  MONTHLY_GRANT: 'Monthly grant', PURCHASE: 'Credit purchase', REFUND: 'Refund', MANUAL_ADJUSTMENT: 'Adjustment',
};
function reasonLabel(r: string | null): string { return (r && REASON_LABEL[r]) || r || '—'; }

const TIMEZONES = [
  'Europe/Berlin', 'Europe/London', 'Europe/Paris', 'Europe/Madrid', 'Europe/Warsaw', 'Europe/Moscow',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Sao_Paulo',
  'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney', 'UTC',
];
const DAYS = [
  { v: '1', label: 'Mon' }, { v: '2', label: 'Tue' }, { v: '3', label: 'Wed' }, { v: '4', label: 'Thu' },
  { v: '5', label: 'Fri' }, { v: '6', label: 'Sat' }, { v: '7', label: 'Sun' },
];

const PROVIDER_LABEL: Record<MailboxProvider, string> = { SMTP: 'SMTP / IMAP', GMAIL: 'Google Workspace', OUTLOOK: 'Microsoft 365' };
const MB_STATUS_TONE: Record<MailboxStatus, string> = {
  CONNECTED: 'bg-emerald-100 text-emerald-700', WARMING: 'bg-amber-100 text-amber-700',
  PAUSED: 'bg-surface-2 text-ink-muted', ERROR: 'bg-rose-100 text-rose-700',
};
const MB_STATUS_LABEL: Record<MailboxStatus, string> = { CONNECTED: 'Connected', WARMING: 'Warming up', PAUSED: 'Paused', ERROR: 'Error' };

type SectionKey = 'account' | 'security' | 'workspace' | 'billing' | 'mailboxes' | 'integrations' | 'team';

const NAV: { key: SectionKey; label: string; icon: ReactNode }[] = [
  { key: 'account', label: 'Account', icon: <UserCircle size={16} strokeWidth={1.9} /> },
  { key: 'security', label: 'Security', icon: <ShieldCheck size={16} strokeWidth={1.9} /> },
  { key: 'workspace', label: 'Workspace', icon: <Building2 size={16} strokeWidth={1.9} /> },
  { key: 'billing', label: 'Billing & Credits', icon: <CreditCard size={16} strokeWidth={1.9} /> },
  { key: 'mailboxes', label: 'Mailboxes & Domains', icon: <MailboxIcon size={16} strokeWidth={1.9} /> },
  { key: 'integrations', label: 'Integrations', icon: <Plug size={16} strokeWidth={1.9} /> },
  { key: 'team', label: 'Team & Permissions', icon: <Users size={16} strokeWidth={1.9} /> },
];

const PLANS = [
  { id: 'STARTER', name: 'Starter', price: '$49', credits: '1,500 credits/mo', features: ['1,500 AI credits', '3 active campaigns', 'Email outreach', 'AI message generation'] },
  { id: 'GROWTH', name: 'Growth', price: '$149', credits: '6,000 credits/mo', features: ['6,000 AI credits', '10 campaigns', 'Email + LinkedIn', 'Apollo.io enrichment', 'Priority support'] },
  { id: 'AGENCY', name: 'Agency', price: '$399', credits: '20,000 credits/mo', features: ['20,000 AI credits', 'Unlimited campaigns', 'All channels', 'White-label', 'Dedicated support'] },
];

// M16-5: человекочитаемые ярлыки модулей для usage breakdown (source из CreditTransaction).
const MODULE_LABELS: Record<string, string> = {
  AI_ATTRIBUTE: 'AI attributes',
  RESEARCH: 'Research',
  ENRICHMENT: 'Enrichment',
  AUTO_RESPONSE: 'Auto-response',
  BULK_RUN: 'Bulk runs',
  MANUAL: 'Manual',
  ADJUSTMENT: 'Adjustments',
  STRIPE: 'Stripe',
  GRANT: 'Grants',
  PURCHASE: 'Purchases',
};

function SectionCard({ title, desc, action, children }: { title: string; desc?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-bold tracking-[-0.01em] text-ink">{title}</h2>
          {desc && <p className="mt-0.5 text-[13px] text-ink-muted">{desc}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2/40 px-3.5 py-3">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">{label}</dt>
      <dd className="mt-1 text-[14px] font-semibold text-ink">{value ?? '—'}</dd>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const toast = useToast();
  const [section, setSection] = useState<SectionKey>('account');
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<{ plan: string; status: string; currentPeriodEnd?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [credits, setCredits] = useState<AiCreditBalance | null>(null);
  const [txns, setTxns] = useState<AiCreditTransaction[]>([]);
  // M16-3: единый billing-overview (plan/status/period + credits + ledger) — numbers из backend.
  const [bo, setBo] = useState<BillingOverview | null>(null);
  const [reconciling, setReconciling] = useState(false);
  // M16-5: webhook audit + ledger export.
  const [webhookEvents, setWebhookEvents] = useState<StripeWebhookEvent[]>([]);
  const [exporting, setExporting] = useState(false);

  // Team
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [teamCanManage, setTeamCanManage] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);

  // Integrations (живой статус «настроено ли», без раскрытия ключей)
  const [integrations, setIntegrations] = useState<import('@/lib/api').IntegrationStatus[]>([]);
  // Workspace
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [wsCanManage, setWsCanManage] = useState(false);
  const [wsForm, setWsForm] = useState<Workspace | null>(null);
  const [wsSaving, setWsSaving] = useState(false);

  // Mailboxes
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [mbSummary, setMbSummary] = useState<MailboxSummary | null>(null);
  const [mbCanManage, setMbCanManage] = useState(false);
  const [mbBusy, setMbBusy] = useState<string | null>(null);

  // modals
  const [pwdOpen, setPwdOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  function reloadMembers() {
    teamApi.members().then((r) => { setMembers(r.members); setTeamCanManage(r.canManage); setIsOwner(r.isOwner); if (r.canManage) teamApi.audit().then((a) => setAuditEntries(a.entries)).catch(() => {}); }).catch(() => {});
  }
  function reloadMailboxes() {
    settingsApi.listMailboxes().then((r) => { setMailboxes(r.mailboxes); setMbSummary(r.summary); setMbCanManage(r.canManage); }).catch(() => {});
  }

  useEffect(() => {
    Promise.all([authApi.me(), billingApi.subscription()])
      .then(([u, sub]) => { setUser(u as User); setSubscription(sub as typeof subscription); })
      .catch(console.error)
      .finally(() => setLoading(false));
    getAiCreditBalance().then(setCredits).catch(() => {});
    listAiCreditTransactions({ limit: 8 }).then((r) => setTxns(r.transactions)).catch(() => {});
    billingApi.overview().then(setBo).catch(() => {}); // M16-3
    billingApi.webhookEvents().then(setWebhookEvents).catch(() => {}); // M16-5 (admin; MEMBER → 403 → пусто)
    reloadMembers();
    settingsApi.getWorkspace().then((r) => { setWorkspace(r.workspace); setWsForm(r.workspace); setWsCanManage(r.canManage); }).catch(() => {});
    settingsApi.integrations().then((r) => setIntegrations(r.integrations)).catch(() => {});
    reloadMailboxes();
  }, []);

  const creditsText = credits ? `${credits.balance.toLocaleString('en-US')} / ${credits.includedMonthly.toLocaleString('en-US')}` : '—';
  const usedPct = credits && credits.includedMonthly > 0 ? Math.min(100, Math.round((credits.balance / credits.includedMonthly) * 100)) : 0;

  const wsDirty = useMemo(() => {
    if (!workspace || !wsForm) return false;
    return JSON.stringify({ ...workspace, sendDays: [...workspace.sendDays].sort() }) !== JSON.stringify({ ...wsForm, sendDays: [...wsForm.sendDays].sort() });
  }, [workspace, wsForm]);

  const handleCheckout = async (plan: string) => {
    setCheckoutLoading(plan);
    try {
      const r = await billingApi.checkout(plan);
      if (r.url) { window.location.href = r.url; return; }
      // честный demo-gate: без Stripe — никакой подделки оплаты/плана
      if (r.demo) toast.success('Billing is in demo mode', r.message || 'Stripe is not connected — no charge was made and your plan is unchanged.');
    } catch (err) { console.error(err); toast.error('Could not start checkout', 'Try again later.'); } finally { setCheckoutLoading(null); }
  };
  // «Buy credits» — тот же честный demo-gate (без фиктивного увеличения баланса)
  const handleBuyCredits = () => {
    toast.success('Credit top-ups are in demo mode', 'Purchases run through Stripe, which is not connected here. No charge is made and your balance is unchanged. Connect Stripe to enable real top-ups.');
  };
  const handlePortal = async () => {
    try { const { url } = await billingApi.portal(); if (url) window.location.href = url; } catch (err) { console.error(err); }
  };
  // M16-5: экспорт ledger (CSV/JSON) — данные из backend, скачивание через Blob.
  const handleExportLedger = async (format: 'csv' | 'json') => {
    setExporting(true);
    try {
      const data = await billingApi.ledgerExport(format);
      const blob = new Blob([data], { type: format === 'json' ? 'application/json' : 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `credit_ledger.${format}`; a.click(); URL.revokeObjectURL(url);
    } catch { toast.error('Could not export ledger', 'Try again.'); } finally { setExporting(false); }
  };
  // M16-3: reconcile (manager-only на backend) — period-aware сверка баланса с ledger.
  const handleReconcile = async () => {
    setReconciling(true);
    try {
      const r = await billingApi.reconcile();
      toast.success(r.adjusted ? 'Balance reconciled' : 'Balance is consistent', r.adjusted ? `Adjusted: ${r.before?.remaining} → ${r.after?.remaining} remaining.` : 'Ledger matches the balance — no change.');
      billingApi.overview().then(setBo).catch(() => {});
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error('Could not reconcile', err.response?.data?.error || 'Try again.');
    } finally { setReconciling(false); }
  };

  async function saveWorkspace() {
    if (!wsForm) return;
    setWsSaving(true);
    try {
      const { workspace: saved } = await settingsApi.updateWorkspace({
        name: wsForm.name, timezone: wsForm.timezone, sendWindowStart: wsForm.sendWindowStart,
        sendWindowEnd: wsForm.sendWindowEnd, sendDays: wsForm.sendDays, dailySendLimit: wsForm.dailySendLimit,
        autoResponseEnabled: wsForm.autoResponseEnabled, autoResponseMinConfidence: wsForm.autoResponseMinConfidence,
      });
      setWorkspace(saved); setWsForm(saved);
      toast.success('Workspace saved', 'Sending defaults updated for the whole workspace.');
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error('Could not save', err.response?.data?.error || 'Try again.');
    } finally { setWsSaving(false); }
  }

  async function toggleMailbox(m: Mailbox) {
    setMbBusy(m.id);
    try {
      const next: MailboxStatus = m.status === 'PAUSED' ? 'WARMING' : 'PAUSED';
      await settingsApi.updateMailbox(m.id, { status: next });
      reloadMailboxes();
      toast.success(next === 'PAUSED' ? 'Mailbox paused' : 'Mailbox resumed', m.address);
    } catch { toast.error('Action failed', m.address); } finally { setMbBusy(null); }
  }
  async function makeDefault(m: Mailbox) {
    setMbBusy(m.id);
    try { await settingsApi.updateMailbox(m.id, { isDefault: true }); reloadMailboxes(); toast.success('Default sender set', m.address); }
    catch { toast.error('Action failed', m.address); } finally { setMbBusy(null); }
  }
  async function removeMailbox(m: Mailbox) {
    if (!window.confirm(`Disconnect ${m.address}? Outbound from this mailbox will stop.`)) return;
    setMbBusy(m.id);
    try { await settingsApi.removeMailbox(m.id); reloadMailboxes(); toast.success('Mailbox disconnected', m.address); }
    catch { toast.error('Could not disconnect', m.address); } finally { setMbBusy(null); }
  }

  async function setRole(m: TeamMember, role: 'ADMIN' | 'MEMBER') {
    try { await teamApi.setRole(m.id, role); reloadMembers(); toast.success('Role updated', `${m.name} → ${role}`); }
    catch (e) { const err = e as { response?: { data?: { error?: string } } }; toast.error('Could not change role', err.response?.data?.error || 'Try again.'); }
  }
  async function removeMember(m: TeamMember) {
    if (!window.confirm(`Remove ${m.name} from the workspace? Their session is revoked immediately.`)) return;
    try { await teamApi.remove(m.id); reloadMembers(); toast.success('Member removed', `${m.email} · session revoked`); }
    catch (e) { const err = e as { response?: { data?: { error?: string } } }; toast.error('Could not remove', err.response?.data?.error || 'Try again.'); }
  }
  async function toggleActive(m: TeamMember) {
    const next = !(m.isActive ?? true);
    if (!window.confirm(`${next ? 'Reactivate' : 'Deactivate'} ${m.name}?${next ? '' : ' Their session is revoked immediately.'}`)) return;
    try { await teamApi.setActive(m.id, next); reloadMembers(); toast.success(next ? 'Member reactivated' : 'Member deactivated', next ? m.email : `${m.email} · session revoked`); }
    catch (e) { const err = e as { response?: { data?: { error?: string } } }; toast.error('Could not update', err.response?.data?.error || 'Try again.'); }
  }

  return (
    <>
      <Topbar title="Settings" icon={<SettingsIcon size={18} strokeWidth={1.85} />} />

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[228px] shrink-0 flex-col border-r border-line bg-surface/50 p-3 md:flex">
          <p className="px-2 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-subtle">Settings</p>
          {NAV.map((n) => {
            const active = n.key === section;
            return (
              <button key={n.key} type="button" onClick={() => setSection(n.key)}
                className={['group flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors', active ? 'sidebar-active-gradient text-ink ring-1 ring-inset ring-brand-100' : 'text-ink-muted hover:bg-surface-2 hover:text-ink'].join(' ')}>
                <span className={active ? 'text-brand-600' : 'text-ink-subtle group-hover:text-brand-600'}>{n.icon}</span>
                <span className="truncate text-left">{n.label}</span>
              </button>
            );
          })}
          <div className="my-2 border-t border-line" />
          <button type="button" onClick={() => router.push('/settings/objects')}
            className="group flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink">
            <span className="text-ink-subtle group-hover:text-brand-600"><Database size={16} strokeWidth={1.9} /></span>
            <span className="flex-1 truncate text-left">Data model</span>
            <ChevronRight size={14} className="text-ink-subtle" />
          </button>
        </aside>

        <main className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-3xl space-y-6">
            {/* ───────── ACCOUNT ───────── */}
            {section === 'account' && (
              <>
                <SectionCard title="Account" desc="Your personal profile and role in this workspace.">
                  {loading ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{[...Array(6)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
                  ) : (
                    <>
                      <div className="mb-5 flex items-center gap-3">
                        <span className="brand-gradient flex h-14 w-14 items-center justify-center rounded-2xl text-[18px] font-bold text-white shadow-brand ring-1 ring-white/40">{(user?.name ?? 'U').slice(0, 1).toUpperCase()}</span>
                        <div>
                          <p className="text-[16px] font-bold text-ink">{user?.name}</p>
                          <p className="text-[13px] text-ink-muted">{user?.email}</p>
                        </div>
                        <Button size="sm" variant="secondary" className="ml-auto" onClick={() => setProfileOpen(true)}>Edit profile</Button>
                      </div>
                      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Field label="Organization" value={user?.org?.name} />
                        <Field label="Role" value={user?.role} />
                        <Field label="Current plan" value={user?.org?.plan} />
                        <Field label="Leads limit" value={user?.org?.leadsLimit?.toLocaleString()} />
                      </dl>
                    </>
                  )}
                </SectionCard>

                <SectionCard title="Agent access & limits" desc="What the AI-SDR agent can do on your behalf.">
                  <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Your role" value={user?.role ?? 'Owner'} />
                    <Field label="Approval mode" value="Human approval for enterprise" />
                    <Field label="AI credits" value={creditsText} />
                    <Field label="Lead limit" value={user?.org?.leadsLimit?.toLocaleString() ?? '2,000'} />
                  </dl>
                  <div className="mt-3 flex items-center gap-3 rounded-xl border border-brand-100 bg-brand-50/50 px-4 py-3">
                    <ShieldCheck size={16} className="shrink-0 text-brand-600" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-ink">Can approve AI actions</p>
                      <p className="text-[12px] text-ink-muted">You receive items in the cockpit Work Queue and approve sends.</p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">Enabled</span>
                  </div>
                </SectionCard>

                <SectionCard title="Security" desc="Password, active sessions and two-factor authentication.">
                  <button type="button" onClick={() => setSection('security')} className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface-2/40 px-4 py-3 text-left hover:bg-surface-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface text-brand-600 shadow-xs"><ShieldCheck size={15} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-semibold text-ink">Manage account security</p>
                      <p className="text-[12px] text-ink-muted">Change password, review devices, set up 2FA →</p>
                    </div>
                  </button>
                </SectionCard>
              </>
            )}

            {/* M23-2: Appearance (per-user тема) — в Account */}
            {section === 'account' && (
              <SectionCard title="Appearance" desc="Light or dark theme. Saved to your account and applied everywhere.">
                <AppearanceToggle />
              </SectionCard>
            )}

            {/* ───────── SECURITY (M23-1) ───────── */}
            {section === 'security' && (
              <SectionCard title="Security" desc="Self-service: password, active device sessions and two-factor authentication (TOTP). Only you can manage these.">
                <SecuritySettings />
              </SectionCard>
            )}

            {/* ───────── WORKSPACE ───────── */}
            {section === 'workspace' && (
              <>
              {/* M23-2: General (logo/domain), Plan, Storage */}
              <SectionCard title="Workspace general" desc="Logo, company domain, plan and storage.">
                <WorkspaceGeneral onSection={(s) => setSection(s as SectionKey)} />
              </SectionCard>
              <SectionCard
                title="Workspace"
                desc="Name, timezone and sending defaults applied across every campaign."
                action={wsCanManage ? (
                  <Button size="sm" variant="primary" disabled={!wsDirty || wsSaving} loading={wsSaving} onClick={saveWorkspace}><Save size={14} strokeWidth={2} /> Save changes</Button>
                ) : <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-ink-subtle">View only · ask an admin</span>}
              >
                {!wsForm ? (
                  <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-12 rounded-xl" />)}</div>
                ) : (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Input label="Workspace name" value={wsForm.name} disabled={!wsCanManage} onChange={(e) => setWsForm({ ...wsForm, name: e.target.value })} />
                      <div className="flex flex-col gap-1">
                        <label className="text-[12px] font-medium text-ink-muted">Timezone</label>
                        <select value={wsForm.timezone} disabled={!wsCanManage} onChange={(e) => setWsForm({ ...wsForm, timezone: e.target.value })}
                          className="h-10 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-[14px] text-ink focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:opacity-60">
                          {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                        </select>
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-ink"><Clock size={13} className="text-brand-600" /> Sending window</p>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <Input label="From" type="time" value={wsForm.sendWindowStart} disabled={!wsCanManage} onChange={(e) => setWsForm({ ...wsForm, sendWindowStart: e.target.value })} />
                        <Input label="To" type="time" value={wsForm.sendWindowEnd} disabled={!wsCanManage} onChange={(e) => setWsForm({ ...wsForm, sendWindowEnd: e.target.value })} />
                        <Input label="Daily limit / mailbox" type="number" min={1} max={2000} value={wsForm.dailySendLimit} disabled={!wsCanManage}
                          onChange={(e) => setWsForm({ ...wsForm, dailySendLimit: Math.max(1, Number(e.target.value) || 1) })} />
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-[12px] font-semibold text-ink">Sending days</p>
                      <div className="flex flex-wrap gap-1.5">
                        {DAYS.map((d) => {
                          const on = wsForm.sendDays.includes(d.v);
                          return (
                            <button key={d.v} type="button" disabled={!wsCanManage}
                              onClick={() => setWsForm({ ...wsForm, sendDays: on ? wsForm.sendDays.filter((x) => x !== d.v) : [...wsForm.sendDays, d.v] })}
                              className={['h-9 w-12 rounded-lg border text-[12.5px] font-semibold transition-colors disabled:opacity-60', on ? 'border-brand-400/60 sidebar-active-gradient text-ink' : 'border-line bg-surface text-ink-subtle hover:bg-surface-2'].join(' ')}>
                              {d.label}
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-2 text-[12px] text-ink-subtle">The agent only sends within this window, in the workspace timezone. Used by the outbound scheduler.</p>
                    </div>

                    {/* M14-5: Auto-response (autopilot) */}
                    <div className="rounded-xl border border-line bg-surface-2/30 p-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-ink"><Sparkles size={14} className="text-brand-600" /> Auto-response (autopilot)</p>
                          <p className="mt-1 text-[12px] text-ink-subtle">When on, the agent sends replies on its own — but <b>only low-risk ones</b> (exact attribution, no pricing/legal/security/unsubscribe, confidence above the threshold). Everything risky is held for a human.</p>
                        </div>
                        <button type="button" role="switch" aria-checked={wsForm.autoResponseEnabled} disabled={!wsCanManage}
                          onClick={() => setWsForm({ ...wsForm, autoResponseEnabled: !wsForm.autoResponseEnabled })}
                          className={['relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60', wsForm.autoResponseEnabled ? 'bg-brand-600' : 'bg-line-strong'].join(' ')}>
                          <span className={['absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', wsForm.autoResponseEnabled ? 'left-[22px]' : 'left-0.5'].join(' ')} />
                        </button>
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <span className="text-[12px] font-semibold text-ink">Min confidence</span>
                        <input type="range" min={50} max={100} step={1} disabled={!wsCanManage || !wsForm.autoResponseEnabled}
                          value={Math.round(wsForm.autoResponseMinConfidence * 100)}
                          onChange={(e) => setWsForm({ ...wsForm, autoResponseMinConfidence: Number(e.target.value) / 100 })}
                          className="flex-1 accent-brand-600 disabled:opacity-50" />
                        <span className="w-10 text-right text-[12.5px] font-bold text-brand-700">{Math.round(wsForm.autoResponseMinConfidence * 100)}%</span>
                      </div>
                    </div>
                  </div>
                )}
              </SectionCard>
              </>
            )}

            {/* ───────── BILLING ───────── */}
            {section === 'billing' && (
              <>
                {/* M16-3: plan / subscription status / period / cancel-at-period-end — честно из backend */}
                <SectionCard title="Plan & subscription" desc="Synced from Stripe — status reflects the real subscription."
                  action={bo?.hasSubscription ? <Button size="sm" variant="secondary" onClick={handlePortal}>Manage billing</Button> : undefined}>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5"><p className="text-[10px] font-bold uppercase tracking-wide text-ink-subtle">Plan</p><p className="text-[18px] font-extrabold text-brand-700">{bo?.plan ?? user?.org?.plan ?? '—'}</p></div>
                    <div className="rounded-xl border border-line bg-surface-2/40 px-4 py-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-ink-subtle">Status</p>
                      <p className={`text-[14px] font-bold ${bo?.subscriptionStatus === 'active' ? 'text-emerald-600' : bo?.subscriptionStatus === 'past_due' ? 'text-amber-600' : bo?.subscriptionStatus === 'canceled' ? 'text-rose-600' : 'text-ink-muted'}`}>{(bo?.subscriptionStatus ?? 'demo').replace('_', ' ')}</p>
                    </div>
                    {bo?.currentPeriodEnd && <div className="rounded-xl border border-line bg-surface-2/40 px-4 py-2.5"><p className="text-[10px] font-bold uppercase tracking-wide text-ink-subtle">Renews</p><p className="text-[13px] font-semibold text-ink">{new Date(bo.currentPeriodEnd).toLocaleDateString()}</p></div>}
                  </div>
                  {bo?.cancelAtPeriodEnd && <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-[12px] font-semibold text-amber-700"><Clock size={13} /> Cancels at period end{bo.currentPeriodEnd ? ` · ${new Date(bo.currentPeriodEnd).toLocaleDateString()}` : ''} — access stays active until then.</p>}
                  {!bo?.hasSubscription && <p className="mt-3 text-[12px] text-ink-subtle">Stripe is not connected (demo) — plan changes below run through Stripe checkout when configured.</p>}
                </SectionCard>

                <SectionCard title="Credits" desc="AI credits power research, message generation, reply triage and auto-response."
                  action={<div className="flex gap-2">{user && user.role !== 'MEMBER' && <Button size="sm" variant="secondary" onClick={handleReconcile} loading={reconciling}>Reconcile</Button>}<Button size="sm" variant="primary" onClick={handleBuyCredits}><Sparkles size={14} strokeWidth={2} /> Buy credits</Button></div>}>
                  <div className="rounded-2xl border border-brand-100 bg-[linear-gradient(135deg,rgba(79,70,229,0.08),rgba(217,70,239,0.07))] p-5">
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-subtle">Credits remaining</p>
                        <p className="text-[34px] font-extrabold tabular-nums tracking-[-0.02em] text-ink">{bo?.credits ? bo.credits.remaining.toLocaleString('en-US') : credits ? credits.balance.toLocaleString('en-US') : '—'}</p>
                      </div>
                      {bo?.credits && (
                        <div className="flex gap-4 text-right">
                          <div><p className="text-[10px] font-semibold uppercase text-ink-subtle">Monthly</p><p className="text-[14px] font-bold tabular-nums text-ink">{bo.credits.monthly.toLocaleString()}</p></div>
                          <div><p className="text-[10px] font-semibold uppercase text-ink-subtle">Purchased</p><p className="text-[14px] font-bold tabular-nums text-ink">{bo.credits.purchased.toLocaleString()}</p></div>
                          <div><p className="text-[10px] font-semibold uppercase text-ink-subtle">Used</p><p className="text-[14px] font-bold tabular-nums text-rose-600">{bo.credits.used.toLocaleString()}</p></div>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/70"><div className="h-full rounded-full brand-gradient transition-all" style={{ width: `${bo?.credits ? Math.min(100, Math.round((bo.credits.used / Math.max(1, bo.credits.monthly + bo.credits.purchased)) * 100)) : usedPct}%` }} /></div>
                    {bo?.credits?.periodStart && <p className="mt-2 text-[11px] text-ink-subtle">Period {new Date(bo.credits.periodStart).toLocaleDateString()}{bo.credits.periodEnd ? ` → ${new Date(bo.credits.periodEnd).toLocaleDateString()}` : ''}</p>}
                  </div>
                  {/* M16-3: ledger — source / type / amount / reason / balanceAfter / linked context (всё из backend) */}
                  <div className="mt-4">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-subtle">Ledger · latest transactions</p>
                    {!bo || bo.ledger.length === 0 ? <p className="text-[12.5px] text-ink-subtle">No transactions yet — run AI enrichment to see usage here.</p> : (
                      <div className="overflow-hidden rounded-xl border border-line">
                        {bo.ledger.map((t, i) => (
                          <div key={t.id} className={`flex items-center gap-3 px-3.5 py-2 ${i ? 'border-t border-line' : ''}`}>
                            <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-muted">{t.source.replace(/_/g, ' ').toLowerCase()}</span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[12.5px] font-medium text-ink">{t.reason || t.type.toLowerCase()}{t.link ? <span className="ml-1 text-[10.5px] text-ink-subtle">· {t.link}</span> : ''}</p>
                              <p className="text-[10.5px] text-ink-subtle">{t.type.toLowerCase()} · bal {t.balanceAfter.toLocaleString()} · {new Date(t.createdAt).toLocaleDateString()}</p>
                            </div>
                            <span className={`w-14 text-right text-[12.5px] font-bold tabular-nums ${t.amount < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{t.amount > 0 ? '+' : ''}{t.amount.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </SectionCard>

                {/* M16-5: Usage by module — все суммы из ОДНОГО backend-endpoint (/billing/overview → usage), без client recompute. */}
                <SectionCard title="Usage & reports" desc="Spend this period, broken down by module — from the credit ledger, not client-side counters."
                  action={<div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => handleExportLedger('csv')} loading={exporting}><Download size={14} /> Export CSV</Button><Button size="sm" variant="ghost" onClick={() => handleExportLedger('json')}>JSON</Button></div>}>
                  {!bo?.usage ? <p className="text-[12.5px] text-ink-subtle">No usage recorded this period yet.</p> : (
                    <>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-xl border border-line bg-surface-2/40 px-4 py-2.5"><p className="text-[10px] font-bold uppercase tracking-wide text-ink-subtle">Total spent</p><p className="text-[20px] font-extrabold tabular-nums text-rose-600">{bo.usage.totalSpent.toLocaleString()}</p></div>
                        <div className="rounded-xl border border-line bg-surface-2/40 px-4 py-2.5"><p className="text-[10px] font-bold uppercase tracking-wide text-ink-subtle">Granted / topped up</p><p className="text-[20px] font-extrabold tabular-nums text-emerald-600">{bo.usage.granted.toLocaleString()}</p></div>
                        <div className="rounded-xl border border-line bg-surface-2/40 px-4 py-2.5"><p className="text-[10px] font-bold uppercase tracking-wide text-ink-subtle">Via bulk runs</p><p className="text-[20px] font-extrabold tabular-nums text-ink">{bo.usage.bulkSpend.toLocaleString()}</p></div>
                      </div>
                      <div className="mt-4">
                        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-subtle">By module</p>
                        {Object.keys(bo.usage.byModule).length === 0 ? <p className="text-[12.5px] text-ink-subtle">No spend yet — run AI enrichment, research or auto-response to see a breakdown.</p> : (
                          <div className="space-y-2">
                            {Object.entries(bo.usage.byModule).sort((a, b) => b[1] - a[1]).map(([src, amt]) => {
                              const pct = bo.usage!.totalSpent > 0 ? Math.round((amt / bo.usage!.totalSpent) * 100) : 0;
                              return (
                                <div key={src} className="flex items-center gap-3">
                                  <span className="w-40 shrink-0 text-[12px] font-semibold text-ink">{MODULE_LABELS[src] ?? src.replace(/_/g, ' ').toLowerCase()}</span>
                                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full brand-gradient" style={{ width: `${pct}%` }} /></div>
                                  <span className="w-16 text-right text-[12.5px] font-bold tabular-nums text-ink">{amt.toLocaleString()}</span>
                                  <span className="w-9 text-right text-[11px] tabular-nums text-ink-subtle">{pct}%</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      {bo.usage.adjustments.count > 0 && (
                        <div className="mt-4">
                          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-subtle">Reconcile adjustments · before → after</p>
                          <div className="overflow-hidden rounded-xl border border-line">
                            {bo.usage.adjustments.entries.map((a, i) => (
                              <div key={i} className={`flex items-center gap-3 px-3.5 py-2 ${i ? 'border-t border-line' : ''}`}>
                                <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">adjustment</span>
                                <div className="min-w-0 flex-1"><p className="truncate text-[12.5px] font-medium text-ink">{a.reason || 'balance reconciled'}</p><p className="text-[10.5px] text-ink-subtle">{new Date(a.at).toLocaleString()}</p></div>
                                <span className="text-[12px] font-semibold tabular-nums text-ink-muted">{String((a.before as { remaining?: number })?.remaining ?? a.before ?? '—')} → {String((a.after as { remaining?: number })?.remaining ?? a.after ?? '—')}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </SectionCard>

                {/* M16-5: Stripe webhook audit — eventId / type / status / attempts / processedAt / error. Только admin (MEMBER → 403 → секция скрыта). */}
                {user && user.role !== 'MEMBER' && webhookEvents.length > 0 && (
                  <SectionCard title="Stripe webhook audit" desc="Every webhook Stripe sent, with idempotent processing status — proof billing stays in sync.">
                    <div className="overflow-hidden rounded-xl border border-line">
                      <div className="flex items-center gap-3 bg-surface-2/50 px-3.5 py-2 text-[10px] font-bold uppercase tracking-wide text-ink-subtle"><span className="flex-1">Event</span><span className="w-20">Status</span><span className="w-14 text-center">Tries</span><span className="w-32 text-right">Processed</span></div>
                      {webhookEvents.map((e, i) => (
                        <div key={e.eventId} className={`flex items-center gap-3 px-3.5 py-2 ${i ? 'border-t border-line' : ''}`}>
                          <div className="min-w-0 flex-1"><p className="truncate text-[12.5px] font-medium text-ink">{e.type}</p><p className="truncate text-[10.5px] text-ink-subtle">{e.eventId}{e.error ? <span className="text-rose-600"> · {e.error}</span> : ''}</p></div>
                          <span className={`w-20 text-[11px] font-bold uppercase ${e.status === 'PROCESSED' ? 'text-emerald-600' : e.status === 'FAILED' ? 'text-rose-600' : 'text-amber-600'}`}>{e.status.toLowerCase()}</span>
                          <span className="w-14 text-center text-[12px] tabular-nums text-ink-muted">{e.attempts}</span>
                          <span className="w-32 text-right text-[11px] text-ink-subtle">{e.processedAt ? new Date(e.processedAt).toLocaleString() : '—'}</span>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                )}

                <SectionCard title="Plans" desc="Choose the plan that fits your outbound volume.">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {PLANS.map((plan) => {
                      const isCurrent = user?.org?.plan === plan.id;
                      return (
                        <div key={plan.id} className={`rounded-2xl border p-4 ${isCurrent ? 'border-brand-300 bg-brand-50 shadow-sm' : 'border-line bg-surface'}`}>
                          <div className="mb-1 flex items-center justify-between">
                            <h3 className="text-[14px] font-bold text-ink">{plan.name}</h3>
                            {isCurrent && <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white">CURRENT</span>}
                          </div>
                          <p className="text-[24px] font-extrabold tracking-[-0.02em] text-ink">{plan.price}<span className="text-[13px] font-medium text-ink-subtle">/mo</span></p>
                          <p className="mb-3 text-[12px] font-semibold text-brand-700">{plan.credits}</p>
                          <ul className="mb-4 space-y-1.5">{plan.features.map((f) => <li key={f} className="flex items-center gap-1.5 text-[12px] text-ink-muted"><Check size={13} strokeWidth={2.5} className="shrink-0 text-emerald-500" />{f}</li>)}</ul>
                          <Button size="sm" variant={isCurrent ? 'secondary' : 'primary'} className="w-full" disabled={isCurrent} loading={checkoutLoading === plan.id} onClick={() => handleCheckout(plan.id)}>{isCurrent ? 'Current plan' : 'Upgrade'}</Button>
                        </div>
                      );
                    })}
                  </div>
                </SectionCard>
              </>
            )}

            {/* ───────── MAILBOXES ───────── */}
            {section === 'mailboxes' && (
              <SectionCard title="Mailboxes & Domains" desc="Connected sending accounts and warm-up status for deliverability."
                action={mbCanManage ? <Button size="sm" variant="primary" onClick={() => setConnectOpen(true)}><Plus size={14} strokeWidth={2.2} /> Connect mailbox</Button> : undefined}>
                {mbSummary && mbSummary.total > 0 && (
                  <div className="mb-4 grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-line bg-surface-2/40 px-3 py-2.5"><p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">Connected</p><p className="text-[18px] font-extrabold text-ink">{mbSummary.healthy}/{mbSummary.total}</p></div>
                    <div className="rounded-xl border border-line bg-surface-2/40 px-3 py-2.5"><p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">Warming up</p><p className="text-[18px] font-extrabold text-ink">{mbSummary.warming}</p></div>
                    <div className="rounded-xl border border-line bg-surface-2/40 px-3 py-2.5"><p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">Daily capacity</p><p className="text-[18px] font-extrabold text-ink">{mbSummary.dailyCapacity.toLocaleString()}</p></div>
                  </div>
                )}

                {mailboxes.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-line py-10 text-center">
                    <MailboxIcon size={22} className="mx-auto mb-2 text-ink-subtle" />
                    <p className="text-[13px] font-semibold text-ink">No mailboxes connected</p>
                    <p className="mt-0.5 text-[12px] text-ink-muted">Connect a sending account so the agent can send and warm up safely.</p>
                    {mbCanManage && <Button size="sm" variant="secondary" className="mt-3" onClick={() => setConnectOpen(true)}><Plus size={14} /> Connect mailbox</Button>}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {mailboxes.map((m) => (
                      <div key={m.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/40 px-4 py-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><MailboxIcon size={16} /></span>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink">
                            {m.address}
                            {m.isDefault && <span className="inline-flex items-center gap-0.5 rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-700"><Star size={9} fill="currentColor" /> Default</span>}
                          </p>
                          <p className="text-[12px] text-ink-muted">{PROVIDER_LABEL[m.provider]} · {m.dailyLimit}/day{m.status === 'WARMING' ? ` · warm-up day ${m.warmupDay}` : ''}</p>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${MB_STATUS_TONE[m.status]}`}>{MB_STATUS_LABEL[m.status]}</span>
                        {mbCanManage && (
                          <div className="flex items-center gap-1">
                            {!m.isDefault && m.status !== 'PAUSED' && (
                              <button type="button" title="Set as default sender" disabled={mbBusy === m.id} onClick={() => makeDefault(m)} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-subtle hover:bg-surface hover:text-brand-600 disabled:opacity-50"><Star size={14} /></button>
                            )}
                            <button type="button" title={m.status === 'PAUSED' ? 'Resume' : 'Pause'} disabled={mbBusy === m.id} onClick={() => toggleMailbox(m)} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-subtle hover:bg-surface hover:text-ink disabled:opacity-50">{m.status === 'PAUSED' ? <Play size={14} /> : <Pause size={14} />}</button>
                            <button type="button" title="Disconnect" disabled={mbBusy === m.id} onClick={() => removeMailbox(m)} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-subtle hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"><Trash2 size={14} /></button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-[12px] text-amber-800">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
                  Email delivery runs in demo mode until an SMTP/OAuth provider is connected. Connection records, warm-up and limits are live and drive the sending scheduler.
                </div>
              </SectionCard>
            )}

            {/* ───────── INTEGRATIONS ───────── */}
            {section === 'integrations' && (
              <SectionCard title="Integrations" desc="Live status of external providers. Keys are configured server-side (environment variables) — we never fake a connection.">
                <div className="space-y-2.5">
                  {integrations.map((item) => (
                    <div key={item.key} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-2/40 px-4 py-3">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink">{item.name}{item.required && <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">Required</span>}</p>
                        <p className="truncate text-[11.5px] text-ink-muted">{item.purpose}</p>
                        <p className="font-mono text-[11px] text-ink-subtle">{item.key}</p>
                      </div>
                      {item.configured ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700"><Check size={11} /> Connected</span>
                      ) : (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-ink-subtle"><Plug size={11} /> Not configured</span>
                      )}
                    </div>
                  ))}
                  {integrations.length === 0 && <p className="text-[12.5px] text-ink-subtle">Loading…</p>}
                </div>
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-line bg-surface-2/30 px-4 py-3 text-[12px] text-ink-muted">
                  <Plug size={15} className="mt-0.5 shrink-0 text-brand-600" />
                  Status reflects whether each provider key is actually present on the server. Unconfigured providers run in demo mode (no fake-success); set the environment variable to enable real use.
                </div>
              </SectionCard>
            )}

            {/* ───────── TEAM ───────── */}
            {section === 'team' && (
              <>
              <SectionCard title="Team & Permissions" desc="Invite teammates and manage their access."
                action={teamCanManage ? <Button size="sm" variant="primary" onClick={() => setInviteOpen(true)}><Users size={14} strokeWidth={2} /> Invite member</Button> : undefined}>
                <div className="space-y-2.5">
                  {members.length === 0 && <p className="text-[12.5px] text-ink-subtle">Loading members…</p>}
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/40 px-4 py-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] text-[12px] font-bold text-white">{(m.name || m.email).slice(0, 1).toUpperCase()}</span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink">{m.name}{m.id === user?.id && <span className="text-[11px] font-normal text-ink-subtle">(you)</span>}{m.isActive === false && <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">Deactivated</span>}</p>
                        <p className="text-[12px] text-ink-muted">{m.email}</p>
                      </div>
                      {/* Смена роли — только владелец и не над владельцем/собой */}
                      {isOwner && m.role !== 'OWNER' && m.id !== user?.id ? (
                        <select value={m.role} onChange={(e) => setRole(m, e.target.value as 'ADMIN' | 'MEMBER')}
                          className="h-8 rounded-lg border border-line bg-[var(--surface)] px-2 text-[12px] font-semibold text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100">
                          <option value="ADMIN">ADMIN</option>
                          <option value="MEMBER">MEMBER</option>
                        </select>
                      ) : (
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ROLE_TONE[m.role] ?? 'bg-surface-2 text-ink-muted'}`}>{m.role}</span>
                      )}
                      {teamCanManage && m.role !== 'OWNER' && m.id !== user?.id && (
                        <>
                          <button type="button" title={m.isActive === false ? 'Reactivate' : 'Deactivate (revokes session)'} onClick={() => toggleActive(m)} className={`flex h-8 w-8 items-center justify-center rounded-lg ${m.isActive === false ? 'text-emerald-600 hover:bg-emerald-50' : 'text-ink-subtle hover:bg-amber-50 hover:text-amber-600'}`}>{m.isActive === false ? <RotateCcw size={14} /> : <Ban size={14} />}</button>
                          <button type="button" title="Remove member (revokes session)" onClick={() => removeMember(m)} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-subtle hover:bg-rose-50 hover:text-rose-600"><Trash2 size={14} /></button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-surface-2/30 px-4 py-3 text-[12.5px] text-ink-muted">
                  <ShieldCheck size={15} className="text-brand-600" />
                  Roles: Owner controls billing, Admin manages campaigns & data, Member runs day-to-day.
                  <a href="#" className="ml-auto inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">Docs <ExternalLink size={12} /></a>
                </div>
              </SectionCard>

              {/* Teams & expert groups (M21-2) */}
              <SectionCard title="Teams" desc="Group members into teams for team-level access (Sales-EU/US/UK), or external expert groups with no default access.">
                <TeamsManager canManage={teamCanManage} />
              </SectionCard>

              {/* Permissions matrix (M21-1/M21-2) — workspace-дефолты + per-entity overrides по Workspace/Team/Individual */}
              <SectionCard title="Workspace access" desc="Default access level per entity type for all members, with per-entity overrides by Workspace / Team / Individual. 4 levels: No access / Read only / Read & write / Full access. Precedence: Individual > Team > Workspace.">
                <PermissionsMatrix canManage={teamCanManage} />
              </SectionCard>

              {/* Automation grants (M21-2, S352) */}
              <SectionCard title="Automations access" desc="Per-workflow access to Objects & Lists. Without a grant, a workflow’s mutating step fails with PERMISSION_DENIED.">
                <AutomationGrants canManage={teamCanManage} />
              </SectionCard>

              {/* Audit log — access-sensitive события (прод-готовность/наблюдаемость) */}
              <SectionCard title="Access audit log" desc="Recent access-sensitive changes. Role changes, removals and deactivations revoke the member's session immediately.">
                {auditEntries.length === 0 ? (
                  <p className="flex items-center gap-2 text-[12.5px] text-ink-subtle"><ShieldAlert size={15} className="text-ink-subtle" /> No access changes yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {auditEntries.map((a) => (
                      <div key={a.id} className="flex items-center gap-3 rounded-lg border border-line bg-surface-2/30 px-3 py-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface text-ink-muted shadow-xs"><History size={13} /></span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] font-medium text-ink">{a.summary}</p>
                          <p className="text-[11px] text-ink-subtle">{a.actorName ?? 'system'} · {new Date(a.createdAt).toLocaleString()}</p>
                        </div>
                        <span className="shrink-0 rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ink-subtle">{a.action}</span>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
              </>
            )}
          </div>
        </main>
      </div>

      {/* ───────── Modals ───────── */}
      {user && <EditProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} name={user.name} onSaved={(u) => { setUser(u); setStoredUser(u); toast.success('Profile updated'); }} />}
      <ChangePasswordModal open={pwdOpen} onClose={() => setPwdOpen(false)} onDone={() => toast.success('Password updated', 'Use your new password next sign-in.')} />
      <ConnectMailboxModal open={connectOpen} onClose={() => setConnectOpen(false)} onDone={() => { reloadMailboxes(); toast.success('Mailbox connected', 'Warm-up started automatically.'); }} />
      <InviteMemberModal open={inviteOpen} onClose={() => setInviteOpen(false)} onDone={() => reloadMembers()} />
    </>
  );
}

/* ══════════════════ Edit profile ══════════════════ */
function EditProfileModal({ open, onClose, name, onSaved }: { open: boolean; onClose: () => void; name: string; onSaved: (u: User) => void }) {
  const [val, setVal] = useState(name);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setVal(name); }, [open, name]);
  async function save() {
    if (!val.trim()) return;
    setBusy(true);
    try { const u = await authApi.updateProfile(val.trim()); onSaved(u as User); onClose(); }
    finally { setBusy(false); }
  }
  return (
    <Modal open={open} onClose={onClose} title="Edit profile" size="sm"
      footer={<><Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button><Button variant="primary" size="sm" loading={busy} disabled={!val.trim()} onClick={save}>Save</Button></>}>
      <div className="p-4"><Input label="Full name" value={val} onChange={(e) => setVal(e.target.value)} placeholder="Your name" /></div>
    </Modal>
  );
}

/* ══════════════════ Change password ══════════════════ */
function ChangePasswordModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [cur, setCur] = useState(''); const [next, setNext] = useState(''); const [conf, setConf] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  useEffect(() => { if (open) { setCur(''); setNext(''); setConf(''); setErr(''); } }, [open]);
  async function submit() {
    setErr('');
    if (next.length < 8) { setErr('New password must be at least 8 characters.'); return; }
    if (next !== conf) { setErr('Passwords do not match.'); return; }
    setBusy(true);
    try { await authApi.changePassword(cur, next); onDone(); onClose(); }
    catch (e) { const error = e as { response?: { data?: { error?: string } } }; setErr(error.response?.data?.error || 'Could not change password.'); }
    finally { setBusy(false); }
  }
  return (
    <Modal open={open} onClose={onClose} title="Change password" size="sm"
      footer={<><Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button><Button variant="primary" size="sm" loading={busy} disabled={!cur || !next || !conf} onClick={submit}>Update password</Button></>}>
      <div className="space-y-3 p-4">
        <Input label="Current password" type="password" value={cur} onChange={(e) => setCur(e.target.value)} />
        <Input label="New password" type="password" hint="At least 8 characters." value={next} onChange={(e) => setNext(e.target.value)} />
        <Input label="Confirm new password" type="password" value={conf} onChange={(e) => setConf(e.target.value)} error={err || undefined} />
      </div>
    </Modal>
  );
}

/* ══════════════════ Connect mailbox ══════════════════ */
function ConnectMailboxModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [address, setAddress] = useState(''); const [fromName, setFromName] = useState('');
  const [provider, setProvider] = useState<MailboxProvider>('SMTP'); const [dailyLimit, setDailyLimit] = useState(50);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  useEffect(() => { if (open) { setAddress(''); setFromName(''); setProvider('SMTP'); setDailyLimit(50); setErr(''); } }, [open]);
  async function submit() {
    setErr('');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) { setErr('Enter a valid email address.'); return; }
    setBusy(true);
    try { await settingsApi.connectMailbox({ address: address.trim(), fromName: fromName.trim() || undefined, provider, dailyLimit }); onDone(); onClose(); }
    catch (e) { const error = e as { response?: { data?: { error?: string } } }; setErr(error.response?.data?.error || 'Could not connect mailbox.'); }
    finally { setBusy(false); }
  }
  return (
    <Modal open={open} onClose={onClose} title="Connect mailbox" size="md"
      footer={<><Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button><Button variant="primary" size="sm" loading={busy} disabled={!address} onClick={submit}>Connect</Button></>}>
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Email address" placeholder="sdr@yourdomain.com" value={address} onChange={(e) => setAddress(e.target.value)} error={err || undefined} />
          <Input label="From name (optional)" placeholder="Alex from Acme" value={fromName} onChange={(e) => setFromName(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium text-ink-muted">Provider</label>
            <select value={provider} onChange={(e) => setProvider(e.target.value as MailboxProvider)} className="h-10 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-[14px] text-ink focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100">
              <option value="SMTP">SMTP / IMAP</option><option value="GMAIL">Google Workspace</option><option value="OUTLOOK">Microsoft 365</option>
            </select>
          </div>
          <Input label="Daily send limit" type="number" min={1} max={1000} value={dailyLimit} onChange={(e) => setDailyLimit(Math.max(1, Number(e.target.value) || 1))} />
        </div>
        <div className="flex items-start gap-2 rounded-lg border border-brand-100 bg-brand-50/50 px-3 py-2 text-[12px] text-brand-900">
          <Sparkles size={13} className="mt-0.5 shrink-0 text-brand-600" />
          New mailboxes start in warm-up to protect deliverability. Provider auth is in demo mode until SMTP/OAuth is configured.
        </div>
      </div>
    </Modal>
  );
}

/* ══════════════════ Invite member ══════════════════ */
function InviteMemberModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [email, setEmail] = useState(''); const [name, setName] = useState(''); const [role, setRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const [temp, setTemp] = useState<{ email: string; pwd: string } | null>(null);
  useEffect(() => { if (open) { setEmail(''); setName(''); setRole('MEMBER'); setErr(''); setTemp(null); } }, [open]);
  async function submit() {
    setErr('');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setErr('Enter a valid email.'); return; }
    if (!name.trim()) { setErr('Enter a name.'); return; }
    setBusy(true);
    try { const r = await teamApi.invite({ email: email.trim(), name: name.trim(), role }); setTemp({ email: email.trim(), pwd: r.tempPassword }); onDone(); }
    catch (e) { const error = e as { response?: { data?: { error?: string } } }; setErr(error.response?.data?.error || 'Could not invite.'); }
    finally { setBusy(false); }
  }
  return (
    <Modal open={open} onClose={onClose} title="Invite member" size="md"
      footer={temp ? <Button variant="primary" size="sm" onClick={onClose}>Done</Button> : <><Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button><Button variant="primary" size="sm" loading={busy} disabled={!email || !name} onClick={submit}>Send invite</Button></>}>
      {temp ? (
        <div className="space-y-3 p-4">
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-[12.5px] font-semibold text-emerald-700"><Check size={15} /> Member created — {temp.email}</div>
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2.5">
            <p className="text-[12px] font-semibold text-amber-800">Email delivery is in demo mode</p>
            <p className="mt-0.5 text-[12px] text-amber-700">Share this temporary password securely. They can change it after first sign-in.</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 truncate rounded-md bg-white px-2.5 py-1.5 font-mono text-[13px] font-bold text-ink ring-1 ring-inset ring-amber-200">{temp.pwd}</code>
              <button type="button" onClick={() => { navigator.clipboard?.writeText(temp.pwd); toast.success('Copied'); }} className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-subtle hover:bg-surface-2 hover:text-ink"><Copy size={14} /></button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Full name" placeholder="Jordan Lee" value={name} onChange={(e) => setName(e.target.value)} />
            <Input label="Email" placeholder="jordan@company.com" value={email} onChange={(e) => setEmail(e.target.value)} error={err || undefined} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium text-ink-muted">Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value as 'ADMIN' | 'MEMBER')} className="h-10 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-[14px] text-ink focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100">
              <option value="MEMBER">Member — day-to-day work</option><option value="ADMIN">Admin — manage campaigns & data</option>
            </select>
          </div>
        </div>
      )}
    </Modal>
  );
}
