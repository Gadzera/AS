'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  LayoutDashboard,
  Mail,
  Send,
  Users,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { analyticsApi } from '@/lib/api';
import { composeStore } from '@/lib/composeStore';
import type { AnalyticsStats, Lead } from '@/types';
import Topbar from '@/components/layout/Topbar';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Dot from '@/components/ui/Dot';

/* -------------------------------------------------------------------------- */
/* KPI Card                                                                    */
/* -------------------------------------------------------------------------- */

interface KpiProps {
  label: string;
  value: string | number;
  delta?: number;
  deltaSuffix?: string;
}

function KpiCard({ label, value, delta, deltaSuffix = 'vs last week' }: KpiProps) {
  const positive = (delta ?? 0) >= 0;
  return (
    <div className="bg-white border border-[var(--border)] rounded-lg p-4">
      <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--text-muted)]">
        {label}
      </p>
      <p className="text-[24px] font-semibold leading-none mt-2 tabular-nums text-[var(--text)]">
        {value}
      </p>
      {delta !== undefined && (
        <p
          className="text-[12px] mt-1.5 inline-flex items-center gap-0.5 tabular-nums"
          style={{ color: positive ? 'var(--success)' : 'var(--danger)' }}
        >
          {positive ? (
            <ArrowUp size={10} strokeWidth={2} />
          ) : (
            <ArrowDown size={10} strokeWidth={2} />
          )}
          <span>
            {positive ? '+' : ''}
            {delta}%
          </span>
          <span className="text-[var(--text-subtle)] font-normal ml-1 normal-case">
            {deltaSuffix}
          </span>
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Recharts tooltip                                                            */
/* -------------------------------------------------------------------------- */

interface RechartsPayloadItem {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: RechartsPayloadItem[];
  label?: string | number;
}

function ChartTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="bg-white border border-[var(--border)] rounded-md px-2.5 py-1.5 text-[12px]"
      style={{ boxShadow: 'var(--shadow-popover)' }}
    >
      {label !== undefined && (
        <p className="text-[var(--text-subtle)] mb-1 leading-none">{label}</p>
      )}
      {payload.map((p) => (
        <p
          key={String(p.dataKey ?? p.name)}
          className="leading-tight tabular-nums"
          style={{ color: p.color ?? 'var(--text)' }}
        >
          <span className="text-[var(--text-muted)]">{p.name}: </span>
          <span className="font-semibold text-[var(--text)]">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function scoreColor(score: number): { bg: string; ink: string } {
  if (score >= 80) return { bg: 'var(--success-soft)', ink: 'var(--success)' };
  if (score >= 50) return { bg: 'var(--warning-soft)', ink: 'var(--warning)' };
  return { bg: 'var(--surface-2)', ink: 'var(--text-muted)' };
}

function formatRelative(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = (Date.now() - d) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export default function DashboardPage() {
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsApi
      .stats()
      .then(setStats)
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, []);

  const dailyChart = useMemo(() => {
    const dc = (stats as AnalyticsStats & { dailyChart?: Array<Record<string, number | string>> })
      ?.dailyChart;
    return Array.isArray(dc) ? dc : [];
  }, [stats]);

  const openRate = (stats as AnalyticsStats & { openRate?: number })?.openRate ?? 0;

  const pipelineData = useMemo(() => {
    if (!stats?.leadsByStatus) return [];
    return Object.entries(stats.leadsByStatus).map(([status, count]) => ({
      status: status.toLowerCase(),
      count,
    }));
  }, [stats]);

  if (loading) {
    return (
      <>
        <Topbar title="Dashboard" icon={<LayoutDashboard size={16} strokeWidth={1.75} />} />
        <div className="flex-1 p-6 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-[88px] rounded-lg" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="skeleton h-[244px] rounded-lg" />
            <div className="skeleton h-[244px] rounded-lg" />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar
        title="Dashboard"
        icon={<LayoutDashboard size={16} strokeWidth={1.75} />}
      />

      <div className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto">
        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Total Leads" value={stats?.totalLeads ?? 0} delta={12} />
          <KpiCard label="Active Campaigns" value={stats?.activeCampaigns ?? 0} delta={8} />
          <KpiCard
            label="Emails Sent (7d)"
            value={stats?.emailsSentThisWeek ?? 0}
            delta={24}
          />
          <KpiCard label="Reply Rate" value={`${stats?.replyRate ?? 0}%`} delta={3} />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <section className="bg-white border border-[var(--border)] rounded-lg p-4">
            <header className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-[14px] font-semibold text-[var(--text)] leading-5">
                  Activity (7 days)
                </h2>
                <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
                  Open rate {openRate}%
                </p>
              </div>
            </header>
            <div className="h-[200px]">
              {dailyChart.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyChart} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="sentFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.18} />
                        <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="repFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--success)" stopOpacity={0.18} />
                        <stop offset="100%" stopColor="var(--success)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: 'var(--text-subtle)', fontSize: 11 }}
                      stroke="var(--border)"
                      tickLine={false}
                      axisLine={{ stroke: 'var(--border)' }}
                    />
                    <YAxis
                      tick={{ fill: 'var(--text-subtle)', fontSize: 11 }}
                      stroke="var(--border)"
                      tickLine={false}
                      axisLine={{ stroke: 'var(--border)' }}
                      width={32}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--border-strong)' }} />
                    <Area
                      type="monotone"
                      dataKey="sent"
                      name="Sent"
                      stroke="var(--brand)"
                      fill="url(#sentFill)"
                      strokeWidth={1.5}
                    />
                    <Area
                      type="monotone"
                      dataKey="replies"
                      name="Replies"
                      stroke="var(--success)"
                      fill="url(#repFill)"
                      strokeWidth={1.5}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="h-full flex items-center justify-center text-[13px] text-[var(--text-subtle)]">
                  No activity in the last 7 days.
                </p>
              )}
            </div>
          </section>

          <section className="bg-white border border-[var(--border)] rounded-lg p-4">
            <header className="mb-3">
              <h2 className="text-[14px] font-semibold text-[var(--text)] leading-5">
                Lead pipeline
              </h2>
              <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
                Breakdown of leads by status
              </p>
            </header>
            <div className="h-[200px]">
              {pipelineData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pipelineData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="status"
                      tick={{ fill: 'var(--text-subtle)', fontSize: 10 }}
                      stroke="var(--border)"
                      tickLine={false}
                      axisLine={{ stroke: 'var(--border)' }}
                    />
                    <YAxis
                      tick={{ fill: 'var(--text-subtle)', fontSize: 11 }}
                      stroke="var(--border)"
                      tickLine={false}
                      axisLine={{ stroke: 'var(--border)' }}
                      width={32}
                      allowDecimals={false}
                    />
                    <Tooltip
                      content={<ChartTooltip />}
                      cursor={{ fill: 'var(--surface-2)' }}
                    />
                    <Bar
                      dataKey="count"
                      name="Leads"
                      fill="var(--brand)"
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="h-full flex items-center justify-center text-[13px] text-[var(--text-subtle)]">
                  No leads yet.
                </p>
              )}
            </div>
          </section>
        </div>

        {/* Hot leads */}
        <section className="bg-white border border-[var(--border)] rounded-lg">
          <header className="px-4 py-3 border-b border-[var(--border)] flex items-end justify-between">
            <div>
              <h2 className="text-[16px] font-semibold leading-6 text-[var(--text)]">
                Hot Leads
              </h2>
              <p className="text-[12.5px] text-[var(--text-muted)] mt-0.5">
                Top scoring leads ready for outreach
              </p>
            </div>
            <Link
              href="/leads"
              className="text-[12.5px] text-[var(--text-muted)] hover:text-[var(--text)] inline-flex items-center gap-1 transition-colors"
            >
              View all leads
              <ArrowUpRight size={12} strokeWidth={1.75} />
            </Link>
          </header>

          {!stats?.hotLeads || stats.hotLeads.length === 0 ? (
            <div className="px-4 py-12 flex flex-col items-center text-center">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
                style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-subtle)' }}
              >
                <Users size={24} strokeWidth={1.75} />
              </div>
              <p className="text-[14px] font-semibold text-[var(--text)] mb-1">
                No hot leads yet
              </p>
              <p className="text-[13px] text-[var(--text-muted)] mb-4 max-w-[320px]">
                Start a campaign and we&apos;ll surface leads most likely to reply.
              </p>
              <Link href="/campaigns">
                <Button variant="primary" size="sm">
                  Start a campaign
                </Button>
              </Link>
            </div>
          ) : (
            <div>
              <div className="h-8 px-3 flex items-center border-b border-[var(--border)] text-[11px] uppercase tracking-[0.06em] font-medium text-[var(--text-subtle)]">
                <span className="flex-1">Name</span>
                <span className="hidden md:block w-[180px]">Title</span>
                <span className="hidden md:block w-[140px]">Company</span>
                <span className="w-[64px] text-right">Score</span>
                <span className="w-[140px] text-right">&nbsp;</span>
              </div>
              {stats.hotLeads.slice(0, 5).map((lead: Lead) => {
                const c = scoreColor(lead.score);
                return (
                  <div
                    key={lead.id}
                    className="h-9 px-3 flex items-center border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface-2)] transition-colors duration-100"
                  >
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <Avatar name={`${lead.firstName} ${lead.lastName}`} size={20} />
                      <Link
                        href={`/leads/${lead.id}`}
                        className="text-[13.5px] text-[var(--text)] truncate hover:underline underline-offset-2"
                      >
                        {lead.firstName} {lead.lastName}
                      </Link>
                    </div>
                    <span className="hidden md:block w-[180px] text-[13px] text-[var(--text-muted)] truncate">
                      {lead.title ?? '—'}
                    </span>
                    <span className="hidden md:block w-[140px] text-[13px] text-[var(--text-muted)] truncate">
                      {lead.company ?? '—'}
                    </span>
                    <span className="w-[64px] flex justify-end">
                      <span
                        className="inline-flex items-center justify-center h-5 px-1.5 rounded-sm text-[11px] font-medium tabular-nums"
                        style={{ backgroundColor: c.bg, color: c.ink }}
                      >
                        {lead.score}
                      </span>
                    </span>
                    <span className="w-[140px] flex justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          composeStore.open({
                            recipients: [lead],
                            leadId: lead.id,
                          })
                        }
                        className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[12.5px] font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-white border border-transparent hover:border-[var(--border)] transition-colors duration-100"
                      >
                        <Mail size={12} strokeWidth={1.75} />
                        Compose
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Recent activity */}
        <section className="bg-white border border-[var(--border)] rounded-lg">
          <header className="px-4 py-3 border-b border-[var(--border)]">
            <h2 className="text-[16px] font-semibold leading-6 text-[var(--text)]">
              Recent activity
            </h2>
            <p className="text-[12.5px] text-[var(--text-muted)] mt-0.5">
              Latest outbound and inbound messages
            </p>
          </header>

          {!stats?.recentActivity || stats.recentActivity.length === 0 ? (
            <div className="px-4 py-12 flex flex-col items-center text-center">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
                style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-subtle)' }}
              >
                <Send size={24} strokeWidth={1.75} />
              </div>
              <p className="text-[14px] font-semibold text-[var(--text)] mb-1">
                No activity yet
              </p>
              <p className="text-[13px] text-[var(--text-muted)] max-w-[320px]">
                Once a campaign goes live, messages will appear here in real time.
              </p>
            </div>
          ) : (
            <ul>
              {stats.recentActivity.slice(0, 10).map((item) => {
                const inbound = item.direction === 'INBOUND';
                return (
                  <li
                    key={item.id}
                    className="h-9 px-3 flex items-center border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface-2)] transition-colors duration-100"
                  >
                    <Dot variant={inbound ? 'success' : 'brand'} className="mr-2" />
                    <span className="text-[13px] text-[var(--text-muted)] flex-1 min-w-0 truncate">
                      <span className="text-[var(--text)] font-medium">
                        {inbound ? 'Reply from ' : 'Sent to '}
                      </span>
                      <span className="text-[var(--text)]">{item.leadName}</span>
                      {item.company && (
                        <span className="text-[var(--text-subtle)]"> · {item.company}</span>
                      )}
                      {item.subject && (
                        <span className="text-[var(--text-subtle)]"> — {item.subject}</span>
                      )}
                    </span>
                    <span className="text-[12px] text-[var(--text-subtle)] tabular-nums shrink-0 ml-2">
                      {formatRelative(item.createdAt)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
