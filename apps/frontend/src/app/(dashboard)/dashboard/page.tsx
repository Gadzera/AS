'use client';

import { useEffect, useState } from 'react';
import { analyticsApi } from '@/lib/api';
import type { AnalyticsStats } from '@/types';
import Topbar from '@/components/layout/Topbar';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import { LeadStatusBadge, ScoreBadge } from '@/components/ui/Badge';

function StatCard({
  label,
  value,
  icon,
  color = 'blue',
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color?: 'blue' | 'green' | 'yellow' | 'purple';
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <Card padding="md">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-xl ${colors[color]}`}>{icon}</div>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsApi
      .stats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <>
        <Topbar title="Dashboard" />
        <main className="flex-1 p-6">
          <div className="animate-pulse space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-28 bg-gray-200 rounded-xl" />
              ))}
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Topbar title="Dashboard" />
      <main className="flex-1 p-6 overflow-y-auto">
        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Total Leads"
            value={stats?.totalLeads ?? 0}
            color="blue"
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
          />
          <StatCard
            label="Active Campaigns"
            value={stats?.activeCampaigns ?? 0}
            color="green"
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            }
          />
          <StatCard
            label="Emails Sent (7d)"
            value={stats?.emailsSentThisWeek ?? 0}
            color="purple"
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            }
          />
          <StatCard
            label="Reply Rate (7d)"
            value={`${stats?.replyRate ?? 0}%`}
            color="yellow"
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Hot Leads */}
          <Card padding="md">
            <CardHeader>
              <CardTitle>Hot Leads</CardTitle>
              <span className="text-sm text-gray-500">
                {stats?.hotLeads.length ?? 0} leads
              </span>
            </CardHeader>
            {!stats?.hotLeads.length ? (
              <p className="text-gray-400 text-sm py-4 text-center">
                No hot leads yet. Start a campaign to generate interest.
              </p>
            ) : (
              <div className="space-y-3">
                {stats.hotLeads.map((lead) => (
                  <div key={lead.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 bg-red-100 text-red-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                        {lead.firstName.charAt(0)}{lead.lastName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">
                          {lead.firstName} {lead.lastName}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {lead.title} · {lead.company}
                        </p>
                      </div>
                    </div>
                    <ScoreBadge score={lead.score} />
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Recent Activity */}
          <Card padding="md">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            {!stats?.recentActivity.length ? (
              <p className="text-gray-400 text-sm py-4 text-center">
                No activity yet.
              </p>
            ) : (
              <div className="space-y-3">
                {stats.recentActivity.slice(0, 8).map((item) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                        item.direction === 'OUTBOUND' ? 'bg-blue-500' : 'bg-green-500'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-900 truncate">
                        {item.direction === 'OUTBOUND' ? 'Sent to' : 'Reply from'}{' '}
                        <span className="font-medium">{item.leadName}</span>
                        {item.company && <span className="text-gray-400"> · {item.company}</span>}
                      </p>
                      {item.subject && (
                        <p className="text-xs text-gray-400 truncate">{item.subject}</p>
                      )}
                      {item.replyClass && (
                        <LeadStatusBadge
                          status={
                            item.replyClass === 'INTERESTED'
                              ? 'HOT'
                              : item.replyClass === 'UNSUBSCRIBE'
                              ? 'UNSUBSCRIBED'
                              : 'REPLIED'
                          }
                        />
                      )}
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Lead Status Breakdown */}
        {stats?.leadsByStatus && Object.keys(stats.leadsByStatus).length > 0 && (
          <Card className="mt-6" padding="md">
            <CardHeader>
              <CardTitle>Leads by Status</CardTitle>
            </CardHeader>
            <div className="flex flex-wrap gap-4">
              {Object.entries(stats.leadsByStatus).map(([status, count]) => (
                <div key={status} className="flex items-center gap-2">
                  <LeadStatusBadge status={status as import('@/types').LeadStatus} />
                  <span className="text-sm font-medium text-gray-900">{count}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </main>
    </>
  );
}
