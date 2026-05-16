'use client';

import { useEffect, useState } from 'react';
import { analyticsApi } from '@/lib/api';
import type { AnalyticsStats } from '@/types';
import Topbar from '@/components/layout/Topbar';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import { LeadStatusBadge, ScoreBadge } from '@/components/ui/Badge';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend,
} from 'recharts';

function StatCard({ label, value, sub, icon, color = 'blue' }: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; color?: 'blue' | 'green' | 'yellow' | 'purple';
}) {
  const colors = {
    blue: 'bg-blue-500/10 text-blue-400',
    green: 'bg-green-500/10 text-green-400',
    yellow: 'bg-yellow-500/10 text-yellow-400',
    purple: 'bg-purple-500/10 text-purple-400',
  };
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">{label}</p>
          <p className="text-3xl font-bold text-white">{value}</p>
          {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-lg ${colors[color]}`}>{icon}</div>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-xs">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: <span className="font-bold">{p.value}</span></p>
      ))}
    </div>
  );
};

export default function DashboardPage() {
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsApi.stats().then(setStats).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <>
        <Topbar title="Dashboard" />
        <main className="flex-1 p-6">
          <div className="animate-pulse space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-gray-800 rounded-xl" />)}
            </div>
            <div className="h-64 bg-gray-800 rounded-xl" />
          </div>
        </main>
      </>
    );
  }

  const dailyChart = (stats as any)?.dailyChart ?? [];
  const openRate = (stats as any)?.openRate ?? 0;

  return (
    <>
      <Topbar title="Dashboard" />
      <main className="flex-1 p-6 overflow-y-auto space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Leads" value={stats?.totalLeads ?? 0}
            color="blue"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
          />
          <StatCard label="Emails Sent" value={stats?.emailsSentThisWeek ?? 0} sub="Last 7 days"
            color="purple"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>}
          />
          <StatCard label="Open Rate" value={`${openRate}%`} sub="Tracking pixel"
            color="yellow"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
          />
          <StatCard label="Reply Rate" value={`${stats?.replyRate ?? 0}%`} sub="Last 7 days"
            color="green"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
          />
        </div>

        {/* Activity chart */}
        {dailyChart.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Activity — Last 7 Days</h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={dailyChart} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="replyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
                <Area type="monotone" dataKey="sent" name="Sent" stroke="#6366f1" fill="url(#sentGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="replies" name="Replies" stroke="#22c55e" fill="url(#replyGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Hot Leads */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">🔥 Hot Leads</h3>
              <span className="text-xs text-gray-500">{stats?.hotLeads.length ?? 0} leads</span>
            </div>
            {!stats?.hotLeads.length ? (
              <p className="text-gray-600 text-sm py-4 text-center">No hot leads yet. Start a campaign.</p>
            ) : (
              <div className="space-y-3">
                {stats.hotLeads.map((lead) => (
                  <div key={lead.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 bg-red-900/50 text-red-400 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                        {lead.firstName.charAt(0)}{lead.lastName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-white text-sm truncate">{lead.firstName} {lead.lastName}</p>
                        <p className="text-xs text-gray-500 truncate">{lead.title} · {lead.company}</p>
                      </div>
                    </div>
                    <ScoreBadge score={lead.score} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lead Status Breakdown — bar chart */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Lead Pipeline</h3>
            {stats?.leadsByStatus && Object.keys(stats.leadsByStatus).length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={Object.entries(stats.leadsByStatus).map(([status, count]) => ({ status, count }))}
                  margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="status" tick={{ fill: '#6b7280', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Leads" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-600 text-sm py-4 text-center">No leads yet.</p>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Recent Activity</h3>
          {!stats?.recentActivity.length ? (
            <p className="text-gray-600 text-sm py-4 text-center">No activity yet.</p>
          ) : (
            <div className="divide-y divide-gray-800">
              {stats.recentActivity.slice(0, 10).map((item) => (
                <div key={item.id} className="flex items-center gap-3 py-2.5">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${item.direction === 'OUTBOUND' ? 'bg-indigo-500' : 'bg-green-500'}`} />
                  <p className="text-sm text-gray-300 flex-1 truncate">
                    {item.direction === 'OUTBOUND' ? 'Sent to' : 'Reply from'}{' '}
                    <span className="text-white font-medium">{item.leadName}</span>
                    {item.company && <span className="text-gray-500"> · {item.company}</span>}
                    {item.subject && <span className="text-gray-600"> — {item.subject}</span>}
                  </p>
                  <span className="text-xs text-gray-600 whitespace-nowrap">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
