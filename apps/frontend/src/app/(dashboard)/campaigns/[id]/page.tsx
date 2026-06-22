'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { campaignsApi, analyticsApi } from '@/lib/api';
import type { Campaign, CampaignStats } from '@/types';
import Topbar from '@/components/layout/Topbar';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { CampaignStatusBadge } from '@/components/ui/Badge';
import SequenceBuilder from '@/components/campaigns/SequenceBuilder';

export default function CampaignDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = async () => {
    try {
      const [c, s] = await Promise.all([
        campaignsApi.get(id),
        analyticsApi.campaignStats(id),
      ]);
      setCampaign(c);
      setStats(s);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleStart = async () => {
    setActionLoading(true);
    try {
      await campaignsApi.start(id);
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      alert(msg ?? 'Failed to start campaign');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    setActionLoading(true);
    try {
      await campaignsApi.pause(id);
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <Topbar />
        <main className="flex-1 p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-64" />
            <div className="h-48 bg-gray-200 rounded-xl" />
          </div>
        </main>
      </>
    );
  }

  if (!campaign) {
    return (
      <>
        <Topbar />
        <main className="flex-1 p-6">
          <p className="text-ink-muted">Campaign not found.</p>
          <Link href="/campaigns">
            <Button variant="secondary" className="mt-4">Back to campaigns</Button>
          </Link>
        </main>
      </>
    );
  }

  return (
    <>
      <Topbar title={campaign.name} />
      <main className="flex-1 p-6 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/campaigns">
              <Button size="sm" variant="ghost">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </Button>
            </Link>
            <CampaignStatusBadge status={campaign.status} />
          </div>

          <div className="flex gap-2">
            {(campaign.status === 'DRAFT' || campaign.status === 'PAUSED') && (
              <Button onClick={handleStart} loading={actionLoading}>
                Start Campaign
              </Button>
            )}
            {campaign.status === 'ACTIVE' && (
              <Button variant="secondary" onClick={handlePause} loading={actionLoading}>
                Pause Campaign
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Stats */}
          {stats && (
            <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Enrolled', value: stats.totalEnrolled },
                { label: 'Messages Sent', value: stats.totalMessages },
                { label: 'Reply Rate', value: `${stats.replyRate}%` },
                { label: 'Open Rate', value: `${stats.openRate}%` },
              ].map(({ label, value }) => (
                <Card key={label} padding="sm">
                  <p className="text-xs text-ink-muted">{label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
                </Card>
              ))}
            </div>
          )}

          {/* Sequence Builder + Recipients */}
          <div className="lg:col-span-2 space-y-6">
            <Card padding="md">
              <CardHeader>
                <CardTitle>Email Sequence</CardTitle>
                <span className="text-sm text-ink-muted">
                  {campaign.sequences?.length ?? 0} step{campaign.sequences?.length !== 1 ? 's' : ''}
                </span>
              </CardHeader>
              <SequenceBuilder
                campaignId={id}
                sequences={campaign.sequences ?? []}
                onUpdate={fetchData}
              />
            </Card>

            {/* Recipients — реальные enrolled-лиды (CampaignLead → Lead) */}
            <Card padding="md">
              <CardHeader>
                <CardTitle>Recipients</CardTitle>
                <span className="text-sm text-ink-muted">{campaign.campaignLeads?.length ?? 0} enrolled</span>
              </CardHeader>
              {(campaign.campaignLeads?.length ?? 0) === 0 ? (
                <p className="py-6 text-center text-sm text-ink-muted">No recipients yet — enroll records from Data Hub.</p>
              ) : (
                <div className="divide-y divide-line">
                  {campaign.campaignLeads!.map((cl) => (
                    <div key={cl.id} className="flex items-center gap-3 py-2.5">
                      <span className="brand-gradient flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white">
                        {`${cl.lead.firstName?.[0] ?? ''}${cl.lead.lastName?.[0] ?? ''}`.toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{cl.lead.firstName} {cl.lead.lastName}</p>
                        <p className="truncate text-xs text-ink-muted">{cl.lead.email ?? cl.lead.company ?? '—'}</p>
                      </div>
                      <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-ink-muted">
                        {(cl.status ?? cl.lead.status ?? 'NEW').toString().toLowerCase().replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Campaign Details */}
          <div className="space-y-4">
            <Card padding="md">
              <CardHeader>
                <CardTitle>Campaign Details</CardTitle>
              </CardHeader>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-ink-muted">Channel</dt>
                  <dd className="font-medium text-gray-900">{campaign.channel}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Daily Limit</dt>
                  <dd className="font-medium text-gray-900">{campaign.dailyLimit} emails/day</dd>
                </div>
                {campaign.targetIndustry && (
                  <div>
                    <dt className="text-ink-muted">Target Industry</dt>
                    <dd className="font-medium text-gray-900">{campaign.targetIndustry}</dd>
                  </div>
                )}
                {campaign.targetCountry && (
                  <div>
                    <dt className="text-ink-muted">Target Country</dt>
                    <dd className="font-medium text-gray-900">{campaign.targetCountry}</dd>
                  </div>
                )}
                {campaign.targetSize && (
                  <div>
                    <dt className="text-ink-muted">Company Size</dt>
                    <dd className="font-medium text-gray-900">{campaign.targetSize}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-ink-muted">Created by</dt>
                  <dd className="font-medium text-gray-900">{campaign.user?.name}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Created</dt>
                  <dd className="font-medium text-gray-900">
                    {new Date(campaign.createdAt).toLocaleDateString()}
                  </dd>
                </div>
              </dl>
            </Card>

            {/* Status Breakdown */}
            {stats && Object.keys(stats.statusBreakdown).length > 0 && (
              <Card padding="md">
                <CardHeader>
                  <CardTitle>Lead Status</CardTitle>
                </CardHeader>
                <dl className="space-y-2 text-sm">
                  {Object.entries(stats.statusBreakdown).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <dt className="text-ink-muted capitalize">
                        {status.toLowerCase().replace('_', ' ')}
                      </dt>
                      <dd className="font-semibold text-gray-900">{count}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
