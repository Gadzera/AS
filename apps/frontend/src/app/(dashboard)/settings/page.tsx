'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { authApi, billingApi, api } from '@/lib/api';
import type { User } from '@/types';
import Topbar from '@/components/layout/Topbar';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

const STRIPE_ORIGINS = ['https://checkout.stripe.com', 'https://billing.stripe.com'];
function isSafeStripeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return STRIPE_ORIGINS.some(o => parsed.origin === o);
  } catch {
    return false;
  }
}

const PLANS = [
  { id: 'STARTER', name: 'Starter',  price: '$29/mo',  features: ['500 leads', '3 campaigns', 'Email outreach', 'AI writing'] },
  { id: 'GROWTH',  name: 'Growth',   price: '$49/mo',  features: ['5,000 leads', '10 campaigns', 'Email + LinkedIn', 'PDL lead finder', 'Webhooks'] },
  { id: 'AGENCY',  name: 'Agency',   price: '$99/mo',  features: ['Unlimited leads', 'Unlimited campaigns', 'All channels', 'White-label', 'Priority support'] },
];

const TABS = ['Account', 'Sending', 'Integrations', 'Deliverability', 'Webhooks', 'Billing', 'Referral'] as const;
type Tab = typeof TABS[number];

interface SmtpAccount { id: string; name: string; fromEmail: string; active: boolean; host: string; port: number; }
interface Webhook     { id: string; name: string; url: string; events: string[]; active: boolean; }
interface ReferralInfo { code: string; referrals: number; bonusLeads: number; shareUrl: string; }

export default function SettingsPage() {
  const { success, error: toastError } = useToast();
  const [tab, setTab]       = useState<Tab>('Account');
  const [user, setUser]     = useState<User | null>(null);
  const [subscription, setSubscription] = useState<{ plan: string; status: string; currentPeriodEnd?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  // SMTP accounts
  const [smtpAccounts, setSmtpAccounts] = useState<SmtpAccount[]>([]);
  const [showSmtpModal, setShowSmtpModal] = useState(false);
  const [smtpForm, setSmtpForm] = useState({ name: '', host: 'smtp.gmail.com', port: 587, user: '', pass: '', fromName: '', fromEmail: '' });
  const [addingSmtp, setAddingSmtp] = useState(false);

  // Webhooks
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [webhookForm, setWebhookForm] = useState({ name: '', url: '', events: [] as string[] });
  const [addingWebhook, setAddingWebhook] = useState(false);

  // Integrations / CRM
  const [crmStatus, setCrmStatus]     = useState<{ hubspot: boolean; pipedrive: boolean } | null>(null);
  const [crmLoading, setCrmLoading]   = useState(false);
  const [syncingAll, setSyncingAll]   = useState(false);

  // Referral
  const [referral, setReferral]       = useState<ReferralInfo | null>(null);
  const [referralLoading, setReferralLoading] = useState(false);
  const [refCopied, setRefCopied]     = useState(false);

  // Spam score checker
  const [spamSubject, setSpamSubject] = useState('');
  const [spamBody,    setSpamBody]    = useState('');
  const [spamResult,  setSpamResult]  = useState<{ score: number; grade: string; issues: string[]; passed: string[] } | null>(null);
  const [spamLoading, setSpamLoading] = useState(false);

  // Deliverability
  const [domainInput, setDomainInput] = useState('');
  const [dnsResult, setDnsResult]     = useState<any>(null);
  const [dnsLoading, setDnsLoading]   = useState(false);
  const [delivStats, setDelivStats]   = useState<any>(null);

  const WEBHOOK_EVENTS = ['reply', 'open', 'bounce', 'unsubscribe', 'interested', 'converted'];

  useEffect(() => {
    Promise.all([authApi.me(), billingApi.subscription()])
      .then(([u, sub]) => { setUser(u); setSubscription(sub as any); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (tab === 'Sending') {
      api.get('/smtp').then(r => setSmtpAccounts(r.data)).catch(() => {});
    }
    if (tab === 'Webhooks') {
      api.get('/webhooks').then(r => setWebhooks(r.data)).catch(() => {});
    }
    if (tab === 'Deliverability') {
      api.get('/deliverability/stats').then(r => setDelivStats(r.data)).catch(() => {});
    }
    if (tab === 'Integrations') {
      setCrmLoading(true);
      api.get('/crm/status').then(r => setCrmStatus(r.data)).catch(() => {}).finally(() => setCrmLoading(false));
    }
    if (tab === 'Referral' && !referral) {
      setReferralLoading(true);
      api.get('/referral/code').then(r => setReferral(r.data)).catch(() => {}).finally(() => setReferralLoading(false));
    }
  }, [tab]);

  const handleCheckout = async (plan: string) => {
    setCheckoutLoading(plan);
    try { const { url } = await billingApi.checkout(plan); if (url && isSafeStripeUrl(url)) window.location.href = url; }
    catch { toastError('Checkout failed'); }
    finally { setCheckoutLoading(null); }
  };

  const handleAddSmtp = async () => {
    setAddingSmtp(true);
    try {
      await api.post('/smtp', smtpForm);
      const r = await api.get('/smtp');
      setSmtpAccounts(r.data);
      setShowSmtpModal(false);
      setSmtpForm({ name: '', host: 'smtp.gmail.com', port: 587, user: '', pass: '', fromName: '', fromEmail: '' });
      success('SMTP account added and verified');
    } catch (err: any) {
      toastError(err?.response?.data?.error ?? 'Failed to add account');
    } finally { setAddingSmtp(false); }
  };

  const handleDeleteSmtp = async (id: string) => {
    await api.delete(`/smtp/${id}`);
    setSmtpAccounts(prev => prev.filter(a => a.id !== id));
    success('Account removed');
  };

  const handleToggleSmtp = async (id: string, active: boolean) => {
    await api.put(`/smtp/${id}`, { active });
    setSmtpAccounts(prev => prev.map(a => a.id === id ? { ...a, active } : a));
  };

  const handleAddWebhook = async () => {
    setAddingWebhook(true);
    try {
      await api.post('/webhooks', webhookForm);
      const r = await api.get('/webhooks');
      setWebhooks(r.data);
      setShowWebhookModal(false);
      setWebhookForm({ name: '', url: '', events: [] });
      success('Webhook created');
    } catch (err: any) {
      toastError(err?.response?.data?.error ?? 'Failed to create webhook');
    } finally { setAddingWebhook(false); }
  };

  const checkDns = async () => {
    if (!domainInput.trim()) return;
    setDnsLoading(true);
    try {
      const r = await api.get(`/deliverability/check?domain=${domainInput.trim()}`);
      setDnsResult(r.data);
    } catch { toastError('DNS check failed'); }
    finally { setDnsLoading(false); }
  };

  const checkSpam = async () => {
    if (!spamSubject && !spamBody) return;
    setSpamLoading(true);
    try {
      const r = await api.post('/personalization/spam-check', { subject: spamSubject, body: spamBody });
      setSpamResult(r.data);
    } catch { toastError('Spam check failed'); }
    finally { setSpamLoading(false); }
  };

  const spamGradeColor = (g: string) =>
    g === 'A' ? 'text-green-400' : g === 'B' ? 'text-emerald-400' : g === 'C' ? 'text-yellow-400' : g === 'D' ? 'text-orange-400' : 'text-red-400';
  const spamGradeBg = (g: string) =>
    g === 'A' ? 'bg-green-500/10 border-green-500/20' : g === 'B' ? 'bg-emerald-500/10 border-emerald-500/20' : g === 'C' ? 'bg-yellow-500/10 border-yellow-500/20' : g === 'D' ? 'bg-orange-500/10 border-orange-500/20' : 'bg-red-500/10 border-red-500/20';

  const scoreColor = (s: number) => s >= 80 ? 'text-green-400' : s >= 50 ? 'text-yellow-400' : 'text-red-400';
  const scoreBg    = (s: number) => s >= 80 ? 'bg-green-500/10 border-green-500/20' : s >= 50 ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-red-500/10 border-red-500/20';

  return (
    <>
      <Topbar title="Settings" />
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-4xl">
          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-gray-900/60 border border-gray-800 rounded-xl p-1 w-fit">
            {TABS.map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  tab === t ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="space-y-6"
            >

              {/* ACCOUNT */}
              {tab === 'Account' && (
                <Card padding="md">
                  <CardHeader><CardTitle>Account</CardTitle></CardHeader>
                  {loading ? (
                    <div className="space-y-2"><div className="skeleton h-4 rounded w-48" /><div className="skeleton h-4 rounded w-64" /></div>
                  ) : (
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      {[
                        ['Name', user?.name], ['Email', user?.email],
                        ['Organization', user?.org?.name], ['Role', user?.role],
                        ['Plan', user?.org?.plan], ['Leads limit', user?.org?.leadsLimit?.toLocaleString()],
                      ].map(([label, val]) => (
                        <div key={label as string}>
                          <dt className="text-gray-500 text-xs uppercase tracking-wide">{label}</dt>
                          <dd className="font-medium text-white mt-0.5">{val ?? '—'}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </Card>
              )}

              {/* SENDING / SMTP ROTATION */}
              {tab === 'Sending' && (
                <Card padding="md">
                  <CardHeader>
                    <div>
                      <CardTitle>Sending Accounts</CardTitle>
                      <p className="text-xs text-gray-500 mt-0.5">Emails are rotated across all active accounts to maximize deliverability</p>
                    </div>
                    <Button size="sm" onClick={() => setShowSmtpModal(true)}>+ Add Account</Button>
                  </CardHeader>

                  {smtpAccounts.length === 0 ? (
                    <div className="text-center py-10">
                      <div className="text-3xl mb-2">📧</div>
                      <p className="text-gray-500 text-sm">No sending accounts yet</p>
                      <p className="text-gray-600 text-xs mt-1">Add Gmail, Zoho, or any SMTP account</p>
                      <Button size="sm" className="mt-4" onClick={() => setShowSmtpModal(true)}>Add first account</Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {smtpAccounts.map(acc => (
                        <div key={acc.id} className="flex items-center justify-between p-3 bg-gray-800/40 rounded-lg border border-gray-700/60">
                          <div>
                            <p className="text-sm font-medium text-white">{acc.name}</p>
                            <p className="text-xs text-gray-500">{acc.fromEmail} · {acc.host}:{acc.port}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleSmtp(acc.id, !acc.active)}
                              className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                                acc.active ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-gray-800 text-gray-500 border-gray-700'
                              }`}
                            >
                              {acc.active ? 'Active' : 'Paused'}
                            </button>
                            <Button size="sm" variant="ghost" onClick={() => handleDeleteSmtp(acc.id)}>Remove</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}

              {/* INTEGRATIONS / CRM */}
              {tab === 'Integrations' && (
                <div className="space-y-4">
                  <Card padding="md">
                    <CardHeader>
                      <div>
                        <CardTitle>CRM Integrations</CardTitle>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Set <code className="text-brand-400 bg-brand-500/10 px-1 rounded">HUBSPOT_ACCESS_TOKEN</code> or <code className="text-brand-400 bg-brand-500/10 px-1 rounded">PIPEDRIVE_API_KEY</code> env vars to enable
                        </p>
                      </div>
                      <Button size="sm" variant="secondary" loading={crmLoading} onClick={() => {
                        setCrmLoading(true);
                        api.get('/crm/status').then(r => setCrmStatus(r.data)).catch(() => {}).finally(() => setCrmLoading(false));
                      }}>Refresh Status</Button>
                    </CardHeader>

                    <div className="space-y-3">
                      {[
                        { id: 'hubspot',   name: 'HubSpot',   desc: 'Syncs hot leads to HubSpot Contacts automatically', env: 'HUBSPOT_ACCESS_TOKEN', docs: 'Private App token from HubSpot Settings > Integrations > Private Apps' },
                        { id: 'pipedrive', name: 'Pipedrive', desc: 'Syncs hot leads to Pipedrive Persons automatically', env: 'PIPEDRIVE_API_KEY + PIPEDRIVE_DOMAIN', docs: 'API key from Pipedrive Settings > Personal Preferences > API' },
                      ].map(crm => {
                        const connected = crmStatus ? crmStatus[crm.id as keyof typeof crmStatus] : null;
                        return (
                          <div key={crm.id} className="p-4 bg-gray-800/40 rounded-xl border border-gray-700/60">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-gray-700 border border-gray-600 rounded-lg flex items-center justify-center">
                                  <span className="text-[10px] font-bold text-gray-300">{crm.name.slice(0, 2).toUpperCase()}</span>
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-semibold text-white text-sm">{crm.name}</p>
                                    {crmLoading ? (
                                      <span className="text-xs text-gray-500">checking...</span>
                                    ) : connected === true ? (
                                      <span className="text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full">Connected</span>
                                    ) : connected === false ? (
                                      <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full">Not configured</span>
                                    ) : null}
                                  </div>
                                  <p className="text-xs text-gray-500 mt-0.5">{crm.desc}</p>
                                </div>
                              </div>
                            </div>
                            <div className="mt-3 p-2.5 bg-gray-900/60 rounded-lg">
                              <p className="text-[11px] text-gray-600 font-mono">{crm.env}</p>
                              <p className="text-[11px] text-gray-500 mt-0.5">{crm.docs}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>

                  <Card padding="md">
                    <CardHeader>
                      <div>
                        <CardTitle>Bulk CRM Sync</CardTitle>
                        <p className="text-xs text-gray-500 mt-0.5">Push all HOT leads to configured CRMs at once</p>
                      </div>
                      <Button
                        size="sm"
                        loading={syncingAll}
                        disabled={!crmStatus?.hubspot && !crmStatus?.pipedrive}
                        onClick={async () => {
                          setSyncingAll(true);
                          try {
                            const r = await api.post('/crm/sync-batch', { status: 'HOT' });
                            success(`Synced ${r.data.synced} leads to CRM`);
                          } catch { toastError('Sync failed'); }
                          finally { setSyncingAll(false); }
                        }}
                      >
                        Sync HOT Leads
                      </Button>
                    </CardHeader>
                    <p className="text-xs text-gray-600">
                      Leads are also auto-synced in real-time whenever a reply is classified as INTERESTED.
                    </p>
                  </Card>

                  <Card padding="md">
                    <CardHeader>
                      <CardTitle>Personalized Images</CardTitle>
                    </CardHeader>
                    <p className="text-sm text-gray-400 mb-3">
                      Use Bannerbear to embed the lead's name and company into email images — a proven way to boost reply rates.
                    </p>
                    <div className="p-3 bg-gray-900/60 rounded-lg">
                      <p className="text-[11px] text-gray-600 font-mono">BANNERBEAR_API_KEY=bb_live_xxx...</p>
                      <p className="text-xs text-gray-500 mt-1">Then set a Bannerbear Template ID on each campaign via the campaign settings.</p>
                      <p className="text-xs text-gray-600 mt-0.5">The template must have layers named: <code className="text-brand-400">name</code>, <code className="text-brand-400">company</code>, <code className="text-brand-400">title</code></p>
                    </div>
                  </Card>
                </div>
              )}

              {/* WEBHOOKS */}
              {tab === 'Webhooks' && (
                <Card padding="md">
                  <CardHeader>
                    <div>
                      <CardTitle>Webhooks</CardTitle>
                      <p className="text-xs text-gray-500 mt-0.5">Connect to Zapier, Make, HubSpot, or your own systems</p>
                    </div>
                    <Button size="sm" onClick={() => setShowWebhookModal(true)}>+ Add Webhook</Button>
                  </CardHeader>

                  {webhooks.length === 0 ? (
                    <div className="text-center py-10">
                      <p className="text-gray-500 text-sm">No webhooks yet</p>
                      <p className="text-gray-600 text-xs mt-1">Get notified on reply, open, bounce, interested</p>
                      <Button size="sm" className="mt-4" onClick={() => setShowWebhookModal(true)}>Add webhook</Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {webhooks.map(wh => (
                        <div key={wh.id} className="p-3 bg-gray-800/40 rounded-lg border border-gray-700/60">
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-sm font-medium text-white">{wh.name}</p>
                            <Button size="sm" variant="ghost" onClick={async () => {
                              await api.delete(`/webhooks/${wh.id}`);
                              setWebhooks(prev => prev.filter(w => w.id !== wh.id));
                            }}>Remove</Button>
                          </div>
                          <p className="text-xs text-gray-500 font-mono truncate">{wh.url}</p>
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {wh.events.map(e => (
                              <span key={e} className="text-[10px] px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20">{e}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}

              {/* DELIVERABILITY */}
              {tab === 'Deliverability' && (
                <div className="space-y-4">

                  {/* Spam Score Checker */}
                  <Card padding="md">
                    <CardHeader>
                      <div>
                        <CardTitle>Spam Score Checker</CardTitle>
                        <p className="text-xs text-gray-500 mt-0.5">Test your email before sending — no external service, runs instantly</p>
                      </div>
                    </CardHeader>
                    <div className="space-y-3">
                      <Input
                        label="Subject line"
                        placeholder="Quick question about {company}'s growth..."
                        value={spamSubject}
                        onChange={e => setSpamSubject(e.target.value)}
                      />
                      <div>
                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Email body</label>
                        <textarea
                          className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-brand-500 focus:outline-none resize-none h-28"
                          placeholder="Hi {firstName}, I noticed..."
                          value={spamBody}
                          onChange={e => setSpamBody(e.target.value)}
                        />
                      </div>
                      <Button onClick={checkSpam} loading={spamLoading} disabled={!spamSubject && !spamBody} size="md">
                        Check Spam Score
                      </Button>

                      {spamResult && (
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 pt-2">
                          {/* Grade badge */}
                          <div className={`flex items-center gap-4 p-4 rounded-xl border ${spamGradeBg(spamResult.grade)}`}>
                            <div className={`text-5xl font-black ${spamGradeColor(spamResult.grade)}`}>{spamResult.grade}</div>
                            <div>
                              <p className="text-white font-semibold">Spam Score: {spamResult.score}/100</p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {spamResult.grade === 'A' ? 'Excellent — very unlikely to be flagged' :
                                 spamResult.grade === 'B' ? 'Good — safe to send' :
                                 spamResult.grade === 'C' ? 'Moderate — fix issues before sending' :
                                 spamResult.grade === 'D' ? 'Poor — many spam triggers detected' :
                                 'Failing — will likely land in spam'}
                              </p>
                            </div>
                          </div>

                          {/* Issues */}
                          {spamResult.issues.length > 0 && (
                            <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
                              <p className="text-xs font-semibold text-red-400 mb-2">Issues to fix:</p>
                              <ul className="space-y-1">
                                {spamResult.issues.map((issue, i) => (
                                  <li key={i} className="text-xs text-gray-400 flex items-start gap-1.5">
                                    <span className="text-red-400 mt-0.5">✗</span>{issue}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Passed */}
                          {spamResult.passed.length > 0 && (
                            <div className="p-3 bg-green-500/5 border border-green-500/20 rounded-lg">
                              <p className="text-xs font-semibold text-green-400 mb-2">Passed checks:</p>
                              <ul className="space-y-1">
                                {spamResult.passed.map((p, i) => (
                                  <li key={i} className="text-xs text-gray-400 flex items-start gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0 mt-1" />{p}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </div>
                  </Card>

                  {/* Stats */}
                  {delivStats && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: 'Deliverability Score', value: `${delivStats.deliverabilityScore}`, unit: '/100', color: scoreColor(delivStats.deliverabilityScore) },
                        { label: 'Open Rate', value: `${delivStats.openRate}`, unit: '%', color: 'text-blue-400' },
                        { label: 'Bounce Rate', value: `${delivStats.bounceRate}`, unit: '%', color: delivStats.bounceRate < 2 ? 'text-green-400' : 'text-red-400' },
                        { label: 'Reply Rate', value: `${delivStats.replyRate}`, unit: '%', color: 'text-purple-400' },
                      ].map(s => (
                        <div key={s.label} className={`p-4 rounded-xl border ${scoreBg(parseInt(s.value))}`}>
                          <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                          <p className={`text-2xl font-bold ${s.color}`}>{s.value}<span className="text-sm font-normal text-gray-500">{s.unit}</span></p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* DNS Checker */}
                  <Card padding="md">
                    <CardHeader><CardTitle>DNS Health Check</CardTitle></CardHeader>
                    <div className="flex gap-2 mb-4">
                      <Input
                        placeholder="yourdomain.com"
                        value={domainInput}
                        onChange={e => setDomainInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && checkDns()}
                        className="flex-1"
                      />
                      <Button onClick={checkDns} loading={dnsLoading} size="md">Check</Button>
                    </div>

                    {dnsResult && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                        {/* Score */}
                        <div className={`flex items-center gap-3 p-3 rounded-lg border ${scoreBg(dnsResult.score)}`}>
                          <span className={`text-2xl font-bold ${scoreColor(dnsResult.score)}`}>{dnsResult.score}</span>
                          <div>
                            <p className="text-sm font-medium text-white">Domain Score</p>
                            <p className="text-xs text-gray-500">{dnsResult.domain}</p>
                          </div>
                        </div>

                        {/* SPF / DKIM / DMARC */}
                        {[
                          { label: 'SPF', valid: dnsResult.spf.valid, detail: dnsResult.spf.record ?? 'Not found' },
                          { label: 'DKIM', valid: dnsResult.dkim.valid, detail: dnsResult.dkim.selector ? `selector: ${dnsResult.dkim.selector}` : 'Not found' },
                          { label: 'DMARC', valid: dnsResult.dmarc.valid, detail: dnsResult.dmarc.policy ? `policy: ${dnsResult.dmarc.policy}` : 'Not found' },
                        ].map(item => (
                          <div key={item.label} className="flex items-start gap-3 p-3 bg-gray-800/40 rounded-lg border border-gray-700/60">
                            <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${item.valid ? 'bg-green-500' : 'bg-red-500'}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-white">{item.label}</p>
                              <p className="text-xs text-gray-500 font-mono truncate">{item.detail}</p>
                            </div>
                          </div>
                        ))}

                        {/* Tips */}
                        {dnsResult.tips.length > 0 && (
                          <div className="p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
                            <p className="text-xs font-semibold text-yellow-400 mb-2">How to fix:</p>
                            <ul className="space-y-1">
                              {dnsResult.tips.map((tip: string, i: number) => (
                                <li key={i} className="text-xs text-gray-400 font-mono leading-relaxed">{tip}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </Card>
                </div>
              )}

              {/* BILLING */}
              {tab === 'Billing' && (
                <Card padding="md">
                  <CardHeader>
                    <CardTitle>Billing & Plan</CardTitle>
                    {subscription?.status === 'active' && (
                      <Button size="sm" variant="secondary" onClick={async () => {
                        const { url } = await billingApi.portal(); if (url && isSafeStripeUrl(url)) window.location.href = url;
                      }}>Manage Billing</Button>
                    )}
                  </CardHeader>

                  {subscription && (
                    <div className="mb-6 p-4 bg-gray-800/40 rounded-lg text-sm">
                      <p><span className="text-gray-500">Status:</span> <span className="font-medium capitalize text-white">{subscription.status}</span></p>
                      {subscription.currentPeriodEnd && (
                        <p className="mt-1"><span className="text-gray-500">Renews:</span> <span className="font-medium text-white">{new Date(subscription.currentPeriodEnd).toLocaleDateString()}</span></p>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {PLANS.map(plan => {
                      const isCurrent = user?.org?.plan === plan.id;
                      return (
                        <div key={plan.id} className={`border-2 rounded-xl p-4 ${isCurrent ? 'border-brand-500/60 bg-brand-500/10' : 'border-gray-700'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold text-white">{plan.name}</h3>
                            {isCurrent && <span className="text-xs bg-brand-500 text-white px-2 py-0.5 rounded-full">Current</span>}
                          </div>
                          <p className="text-2xl font-bold text-white mb-3">{plan.price}</p>
                          <ul className="text-xs text-gray-500 space-y-1.5 mb-4">
                            {plan.features.map(f => (
                              <li key={f} className="flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                {f}
                              </li>
                            ))}
                          </ul>
                          <Button size="sm" variant={isCurrent ? 'secondary' : 'primary'} className="w-full"
                            disabled={isCurrent} loading={checkoutLoading === plan.id}
                            onClick={() => handleCheckout(plan.id)}>
                            {isCurrent ? 'Current plan' : 'Upgrade'}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}

              {/* REFERRAL */}
              {tab === 'Referral' && (
                <div className="space-y-4">
                  <Card padding="md">
                    <CardHeader><CardTitle>Реферальная программа</CardTitle></CardHeader>
                    <p className="text-sm text-gray-400 mb-4">
                      Приглашайте коллег и получайте <span className="text-brand-400 font-medium">+500 лидов</span> за каждого нового пользователя. Они получат <span className="text-brand-400 font-medium">+200 лидов</span> в подарок.
                    </p>

                    {referralLoading ? (
                      <div className="space-y-3">
                        <div className="skeleton h-10 rounded-lg" />
                        <div className="skeleton h-10 rounded-lg" />
                      </div>
                    ) : referral ? (
                      <div className="space-y-4">
                        {/* Referral code */}
                        <div>
                          <label className="text-xs text-gray-500 uppercase tracking-wide mb-1.5 block">Ваш код</label>
                          <div className="flex gap-2">
                            <div className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 font-mono text-lg font-bold text-brand-400 tracking-widest">
                              {referral.code}
                            </div>
                            <button
                              onClick={() => { navigator.clipboard.writeText(referral.code); setRefCopied(true); setTimeout(() => setRefCopied(false), 2000); }}
                              className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
                            >
                              {refCopied ? 'Скопировано' : 'Копировать'}
                            </button>
                          </div>
                        </div>

                        {/* Share URL */}
                        <div>
                          <label className="text-xs text-gray-500 uppercase tracking-wide mb-1.5 block">Ссылка для приглашения</label>
                          <div className="flex gap-2">
                            <div className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-400 truncate">
                              {referral.shareUrl}
                            </div>
                            <button
                              onClick={() => { navigator.clipboard.writeText(referral.shareUrl); setRefCopied(true); setTimeout(() => setRefCopied(false), 2000); }}
                              className="px-4 py-2.5 bg-brand-500/20 hover:bg-brand-500/30 border border-brand-500/30 rounded-lg text-sm text-brand-400 transition-colors whitespace-nowrap"
                            >
                              Скопировать ссылку
                            </button>
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-4 pt-2">
                          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 text-center">
                            <p className="text-3xl font-bold text-white">{referral.referrals}</p>
                            <p className="text-xs text-gray-500 mt-1">Приглашено пользователей</p>
                          </div>
                          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 text-center">
                            <p className="text-3xl font-bold text-brand-400">{(referral.bonusLeads).toLocaleString()}</p>
                            <p className="text-xs text-gray-500 mt-1">Бонусных лидов заработано</p>
                          </div>
                        </div>

                        {/* How it works */}
                        <div className="bg-gray-900/40 border border-gray-800/60 rounded-xl p-4">
                          <p className="text-xs font-semibold text-gray-300 mb-2">Как это работает</p>
                          <ol className="text-xs text-gray-500 space-y-1.5 list-none">
                            <li className="flex gap-2"><span className="text-brand-400 font-bold">1.</span> Поделитесь своей реферальной ссылкой</li>
                            <li className="flex gap-2"><span className="text-brand-400 font-bold">2.</span> Друг регистрируется и получает +200 лидов</li>
                            <li className="flex gap-2"><span className="text-brand-400 font-bold">3.</span> Вы получаете +500 лидов на баланс мгновенно</li>
                          </ol>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">Не удалось загрузить реферальный код</p>
                    )}
                  </Card>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Add SMTP Modal */}
      <Modal open={showSmtpModal} onClose={() => setShowSmtpModal(false)} title="Add Sending Account" size="md">
        <div className="space-y-3">
          <Input label="Account name" placeholder="john@acme.com (Gmail)" value={smtpForm.name} onChange={e => setSmtpForm(f => ({ ...f, name: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="SMTP Host" placeholder="smtp.gmail.com" value={smtpForm.host} onChange={e => setSmtpForm(f => ({ ...f, host: e.target.value }))} />
            <Input label="Port" type="number" value={smtpForm.port} onChange={e => setSmtpForm(f => ({ ...f, port: parseInt(e.target.value) || 587 }))} />
          </div>
          <Input label="Username" placeholder="you@gmail.com" value={smtpForm.user} onChange={e => setSmtpForm(f => ({ ...f, user: e.target.value }))} />
          <Input label="Password / App password" type="password" placeholder="••••••••••••" value={smtpForm.pass} onChange={e => setSmtpForm(f => ({ ...f, pass: e.target.value }))} hint="For Gmail: use App Password, not your Google password" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="From name" placeholder="John Smith" value={smtpForm.fromName} onChange={e => setSmtpForm(f => ({ ...f, fromName: e.target.value }))} />
            <Input label="From email" placeholder="john@acme.com" value={smtpForm.fromEmail} onChange={e => setSmtpForm(f => ({ ...f, fromEmail: e.target.value }))} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleAddSmtp} loading={addingSmtp} disabled={!smtpForm.user || !smtpForm.pass} className="flex-1">Add & Verify</Button>
            <Button variant="secondary" onClick={() => setShowSmtpModal(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* Add Webhook Modal */}
      <Modal open={showWebhookModal} onClose={() => setShowWebhookModal(false)} title="Add Webhook" size="md">
        <div className="space-y-3">
          <Input label="Name" placeholder="Notify HubSpot" value={webhookForm.name} onChange={e => setWebhookForm(f => ({ ...f, name: e.target.value }))} />
          <Input label="URL" placeholder="https://hooks.zapier.com/..." value={webhookForm.url} onChange={e => setWebhookForm(f => ({ ...f, url: e.target.value }))} />
          <div>
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Events</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {WEBHOOK_EVENTS.map(evt => {
                const active = webhookForm.events.includes(evt);
                return (
                  <button key={evt} onClick={() => setWebhookForm(f => ({
                    ...f,
                    events: active ? f.events.filter(e => e !== evt) : [...f.events, evt],
                  }))}
                  className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                    active ? 'bg-brand-500/20 text-brand-400 border-brand-500/30' : 'bg-gray-800 text-gray-500 border-gray-700 hover:text-gray-300'
                  }`}>
                    {evt}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleAddWebhook} loading={addingWebhook} disabled={!webhookForm.url || webhookForm.events.length === 0} className="flex-1">Create Webhook</Button>
            <Button variant="secondary" onClick={() => setShowWebhookModal(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
