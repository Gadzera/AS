'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { analyticsApi, api } from '@/lib/api';
import type { AnalyticsStats } from '@/types';
import Topbar from '@/components/layout/Topbar';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts';

// ─── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, icon, trend, color = 'blue',
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; trend?: number; color?: 'blue' | 'green' | 'yellow' | 'purple' | 'red';
}) {
  const palettes = {
    blue:   'from-blue-500/20 to-blue-600/5 border-blue-500/20 text-blue-400',
    green:  'from-green-500/20 to-green-600/5 border-green-500/20 text-green-400',
    yellow: 'from-yellow-500/20 to-yellow-600/5 border-yellow-500/20 text-yellow-400',
    purple: 'from-purple-500/20 to-purple-600/5 border-purple-500/20 text-purple-400',
    red:    'from-red-500/20 to-red-600/5 border-red-500/20 text-red-400',
  };
  return (
    <div className={`relative overflow-hidden rounded-xl border bg-gradient-to-br p-5 ${palettes[color]}`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
          <p className="text-3xl font-bold text-white">{value}</p>
          {sub && <p className="text-xs text-gray-500">{sub}</p>}
          {trend !== undefined && (
            <p className={`text-xs font-medium ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% за 7 дней
            </p>
          )}
        </div>
        <div className="opacity-80">{icon}</div>
      </div>
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-gray-400 mb-1.5 font-medium">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="flex items-center gap-2" style={{ color: p.color }}>
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
          {p.name}: <span className="font-bold text-white ml-1">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-800/60 rounded-xl ${className}`} />;
}

// ─── Status color ────────────────────────────────────────────────────────────
const statusColors: Record<string, string> = {
  NEW: '#6366f1', CONTACTED: '#8b5cf6', REPLIED: '#3b82f6',
  HOT: '#ef4444', CONVERTED: '#22c55e', LOST: '#6b7280', UNSUBSCRIBED: '#374151',
};

interface OnboardingProgress {
  smtpAdded: boolean; firstLeadAdded: boolean;
  firstCampaign: boolean; firstSent: boolean; firstReply: boolean;
}

// ─── Onboarding Checklist ────────────────────────────────────────────────────
function OnboardingChecklist({ progress }: { progress: OnboardingProgress }) {
  const steps = [
    { key: 'smtpAdded',      label: 'Подключить почту для отправки', done: progress.smtpAdded,      link: '/settings' },
    { key: 'firstLeadAdded', label: 'Добавить первого лида',          done: progress.firstLeadAdded, link: '/leads' },
    { key: 'firstCampaign',  label: 'Создать кампанию',               done: progress.firstCampaign,  link: '/campaigns' },
    { key: 'firstSent',      label: 'Отправить первое письмо',         done: progress.firstSent,      link: '/campaigns' },
    { key: 'firstReply',     label: 'Получить первый ответ',           done: progress.firstReply,     link: '/inbox' },
  ];
  const done = steps.filter(s => s.done).length;
  const pct = Math.round(done / steps.length * 100);
  if (done === steps.length) return null;

  return (
    <div className="bg-gradient-to-br from-brand-500/10 to-purple-600/5 border border-brand-500/20 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Начало работы</h3>
          <p className="text-xs text-gray-500 mt-0.5">{done} из {steps.length} шагов выполнено</p>
        </div>
        <div className="text-right">
          <span className="text-xl font-bold text-brand-400">{pct}%</span>
        </div>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full mb-4 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-brand-500 to-purple-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
        {steps.map((step) => (
          <Link key={step.key} href={step.link} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors ${
            step.done ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-gray-800/60 border border-gray-700/50 text-gray-400 hover:border-brand-500/30 hover:text-gray-300'
          }`}>
            <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${step.done ? 'bg-green-500' : 'bg-gray-700'}`}>
              {step.done && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
            </span>
            <span className={step.done ? 'line-through opacity-60' : ''}>{step.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [stats, setStats] = useState<AnalyticsStats & { openRate?: number; dailyChart?: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboarding, setOnboarding] = useState<OnboardingProgress | null>(null);

  useEffect(() => {
    analyticsApi.stats().then(setStats).catch(console.error).finally(() => setLoading(false));
    api.get('/notifications/onboarding').then(r => setOnboarding(r.data)).catch(() => null);
  }, []);

  const dailyChart = (stats as any)?.dailyChart ?? [];
  const openRate   = (stats as any)?.openRate  ?? 0;
  const clickRate  = (stats as any)?.clickRate ?? 0;

  const pipelineData = stats?.leadsByStatus
    ? Object.entries(stats.leadsByStatus).map(([status, count]) => ({ status, count, fill: statusColors[status] ?? '#6366f1' }))
    : [];

  // Funnel calculation
  const totalContacted = (stats?.leadsByStatus?.CONTACTED ?? 0) + (stats?.leadsByStatus?.REPLIED ?? 0)
    + (stats?.leadsByStatus?.HOT ?? 0) + (stats?.leadsByStatus?.CONVERTED ?? 0);
  const totalReplied   = (stats?.leadsByStatus?.REPLIED ?? 0) + (stats?.leadsByStatus?.HOT ?? 0) + (stats?.leadsByStatus?.CONVERTED ?? 0);
  const totalHot       = (stats?.leadsByStatus?.HOT ?? 0) + (stats?.leadsByStatus?.CONVERTED ?? 0);
  const totalConverted = stats?.leadsByStatus?.CONVERTED ?? 0;

  return (
    <>
      <Topbar title="Dashboard" />
      <main className="flex-1 p-6 overflow-y-auto space-y-6">

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {loading ? (
            [...Array(5)].map((_, i) => <Skeleton key={i} className="h-28" />)
          ) : (<>
            <StatCard
              label="Total Leads" value={stats?.totalLeads?.toLocaleString() ?? '0'}
              color="blue"
              icon={<svg className="w-7 h-7 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
            />
            <StatCard
              label="Emails Sent" value={stats?.emailsSentThisWeek?.toLocaleString() ?? '0'} sub="Last 7 days"
              color="purple"
              icon={<svg className="w-7 h-7 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
            />
            <StatCard
              label="Open Rate" value={`${openRate}%`} sub="Last 7 days"
              color="yellow"
              icon={<svg className="w-7 h-7 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
            />
            <StatCard
              label="Click Rate" value={`${clickRate}%`} sub="Link clicks"
              color="green"
              icon={<svg className="w-7 h-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>}
            />
            <StatCard
              label="Reply Rate" value={`${stats?.replyRate ?? 0}%`} sub="Last 7 days"
              color="purple"
              icon={<svg className="w-7 h-7 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>}
            />
          </>)}
        </div>

        {/* ── Onboarding ── */}
        {onboarding && <OnboardingChecklist progress={onboarding} />}

        {/* ── Charts row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Activity chart — spans 2 cols */}
          <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Email Activity — Last 7 Days</h3>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />Sent</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />Replies</span>
              </div>
            </div>
            {loading ? (
              <Skeleton className="h-48" />
            ) : dailyChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={dailyChart} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="replyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="sent" name="Sent" stroke="#6366f1" fill="url(#sentGrad)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="replies" name="Replies" stroke="#22c55e" fill="url(#replyGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-600 text-sm">
                Нет данных. Запустите первую кампанию.
              </div>
            )}
          </div>

          {/* Conversion funnel */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Conversion Funnel</h3>
            {loading ? <Skeleton className="h-48" /> : (
              <div className="space-y-3 mt-2">
                {[
                  { label: 'Contacted', value: totalContacted, color: 'bg-indigo-500', pct: stats?.totalLeads ? Math.round(totalContacted / stats.totalLeads * 100) : 0 },
                  { label: 'Replied',   value: totalReplied,   color: 'bg-blue-500',   pct: totalContacted ? Math.round(totalReplied   / totalContacted * 100) : 0 },
                  { label: 'Hot',       value: totalHot,       color: 'bg-red-500',    pct: totalReplied   ? Math.round(totalHot       / totalReplied   * 100) : 0 },
                  { label: 'Converted', value: totalConverted, color: 'bg-green-500',  pct: totalHot       ? Math.round(totalConverted / totalHot        * 100) : 0 },
                ].map(({ label, value, color, pct }) => (
                  <div key={label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400">{label}</span>
                      <span className="text-white font-semibold">{value.toLocaleString()} <span className="text-gray-600 font-normal">({pct}%)</span></span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${Math.max(pct, value > 0 ? 4 : 0)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Bottom row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Hot Leads */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Hot Leads</h3>
              <Link href="/inbox?filter=hot" className="text-xs text-brand-400 hover:text-brand-300 transition-colors">
                View all →
              </Link>
            </div>
            {loading ? <Skeleton className="h-40" /> : !stats?.hotLeads.length ? (
              <p className="text-gray-600 text-sm py-6 text-center">Нет горячих лидов.<br />Запустите кампанию.</p>
            ) : (
              <div className="space-y-2.5">
                {stats.hotLeads.slice(0, 5).map((lead) => (
                  <Link key={lead.id} href={`/inbox?leadId=${lead.id}`} className="flex items-center gap-3 hover:bg-gray-800/50 rounded-lg p-1.5 -mx-1.5 transition-colors">
                    <div className="w-8 h-8 bg-red-900/40 border border-red-500/20 text-red-400 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                      {lead.firstName.charAt(0)}{lead.lastName?.charAt(0) ?? ''}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-white text-sm truncate">{lead.firstName} {lead.lastName}</p>
                      <p className="text-xs text-gray-500 truncate">{lead.company}</p>
                    </div>
                    <div className="ml-auto shrink-0">
                      <span className="text-[10px] font-bold text-red-400 bg-red-900/30 border border-red-500/20 px-1.5 py-0.5 rounded">HOT</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Lead Pipeline bar chart */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Lead Pipeline</h3>
            {loading ? <Skeleton className="h-40" /> : pipelineData.length > 0 ? (
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={pipelineData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="status" tick={{ fill: '#6b7280', fontSize: 9 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Leads" radius={[4, 4, 0, 0]}>
                    {pipelineData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-600 text-sm py-6 text-center">Нет лидов.</p>
            )}
          </div>

          {/* Recent Activity */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Recent Activity</h3>
              <Link href="/inbox" className="text-xs text-brand-400 hover:text-brand-300 transition-colors">
                Inbox →
              </Link>
            </div>
            {loading ? <Skeleton className="h-40" /> : !stats?.recentActivity.length ? (
              <p className="text-gray-600 text-sm py-6 text-center">Нет активности.</p>
            ) : (
              <div className="space-y-0 divide-y divide-gray-800/60">
                {stats.recentActivity.slice(0, 6).map((item) => (
                  <div key={item.id} className="flex items-start gap-2.5 py-2">
                    <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                      item.direction === 'OUTBOUND' ? 'bg-indigo-500' :
                      item.replyClass === 'INTERESTED' ? 'bg-green-400' :
                      item.replyClass === 'NOT_INTERESTED' ? 'bg-gray-500' : 'bg-blue-400'
                    }`} />
                    <div className="min-w-0">
                      <p className="text-xs text-gray-300 truncate">
                        <span className="text-white font-medium">{item.leadName}</span>
                        {item.company && <span className="text-gray-600"> · {item.company}</span>}
                      </p>
                      <p className="text-[11px] text-gray-600 truncate mt-0.5">
                        {item.direction === 'OUTBOUND' ? '↗ Sent' : '↙ Reply'}
                        {item.subject && ` — ${item.subject}`}
                      </p>
                    </div>
                    <span className="text-[10px] text-gray-700 whitespace-nowrap ml-auto mt-0.5">
                      {new Date(item.createdAt).toLocaleDateString('ru', { day: '2-digit', month: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* ── Active Campaigns quick-view ── */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">
              Active Campaigns
              {stats && <span className="ml-2 text-xs text-gray-600 font-normal">({stats.activeCampaigns} running)</span>}
            </h3>
            <Link href="/campaigns" className="text-xs text-brand-400 hover:text-brand-300 transition-colors">
              Manage →
            </Link>
          </div>
          {loading ? <Skeleton className="h-12" /> : stats?.activeCampaigns === 0 ? (
            <p className="text-gray-600 text-sm py-2 text-center">Нет активных кампаний. <Link href="/campaigns" className="text-brand-400 hover:underline">Создать →</Link></p>
          ) : (
            <p className="text-gray-400 text-sm">
              {stats?.activeCampaigns} кампани{stats?.activeCampaigns === 1 ? 'я' : stats?.activeCampaigns && stats.activeCampaigns < 5 ? 'и' : 'й'} отправляют письма прямо сейчас.
              {' '}<Link href="/campaigns" className="text-brand-400 hover:underline">Смотреть детали →</Link>
            </p>
          )}
        </div>

      </main>
    </>
  );
}
