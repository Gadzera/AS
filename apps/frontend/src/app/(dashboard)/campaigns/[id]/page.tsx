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

interface AbVariantStats {
  variant: string;
  leads: number;
  sent: number;
  opens: number;
  clicks: number;
  replies: number;
  openRate: string;
  clickRate: string;
  replyRate: string;
}

interface AbTestResult {
  campaign: { id: string; name: string; abTestEnabled: boolean };
  variants: AbVariantStats[];
}

interface CampaignLead {
  id: string;
  status: string;
  currentStep: number;
  nextSendAt: string | null;
  lead: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    company: string | null;
    title: string | null;
    status: string;
    score: number;
  };
}

const STATUS_BADGE: Record<string, string> = {
  NEW: 'bg-gray-700 text-gray-300',
  CONTACTED: 'bg-blue-900/40 text-blue-300',
  REPLIED: 'bg-indigo-900/40 text-indigo-300',
  HOT: 'bg-orange-900/40 text-orange-300',
  CONVERTED: 'bg-green-900/40 text-green-300',
  LOST: 'bg-red-900/40 text-red-300',
  UNSUBSCRIBED: 'bg-gray-700 text-gray-400',
};

export default function CampaignDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [abTest, setAbTest] = useState<AbTestResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [leadsPage, setLeadsPage] = useState(0);

  const fetchData = async () => {
    try {
      const [c, s] = await Promise.all([
        campaignsApi.get(id),
        analyticsApi.campaignStats(id),
      ]);
      setCampaign(c);
      setStats(s);
      if (c.abTestEnabled) {
        analyticsApi.abTest(id).then(setAbTest).catch(() => null);
      }
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
          <p className="text-gray-500">Campaign not found.</p>
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

          <div className="flex flex-col items-end gap-2">
            {campaign.channel === 'LINKEDIN' && (campaign.status === 'DRAFT' || campaign.status === 'PAUSED') && (
              <p className="text-xs text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 max-w-xs text-right">
                Make sure your leads have LinkedIn profile URLs — leads without a URL will be skipped automatically.
              </p>
            )}
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
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
                </Card>
              ))}
            </div>
          )}

          {/* Sequence Builder */}
          <div className="lg:col-span-2">
            <Card padding="md">
              <CardHeader>
                <CardTitle>Email Sequence</CardTitle>
                <span className="text-sm text-gray-500">
                  {campaign.sequences?.length ?? 0} step{campaign.sequences?.length !== 1 ? 's' : ''}
                </span>
              </CardHeader>
              <SequenceBuilder
                campaignId={id}
                sequences={campaign.sequences ?? []}
                abTestEnabled={campaign.abTestEnabled}
                onUpdate={fetchData}
              />
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
                  <dt className="text-gray-500">Channel</dt>
                  <dd className="font-medium text-gray-900">{campaign.channel}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Daily Limit</dt>
                  <dd className="font-medium text-gray-900">{campaign.dailyLimit} emails/day</dd>
                </div>
                {campaign.targetIndustry && (
                  <div>
                    <dt className="text-gray-500">Target Industry</dt>
                    <dd className="font-medium text-gray-900">{campaign.targetIndustry}</dd>
                  </div>
                )}
                {campaign.targetCountry && (
                  <div>
                    <dt className="text-gray-500">Target Country</dt>
                    <dd className="font-medium text-gray-900">{campaign.targetCountry}</dd>
                  </div>
                )}
                {campaign.targetSize && (
                  <div>
                    <dt className="text-gray-500">Company Size</dt>
                    <dd className="font-medium text-gray-900">{campaign.targetSize}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-gray-500">Created by</dt>
                  <dd className="font-medium text-gray-900">{campaign.user?.name}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Created</dt>
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
                      <dt className="text-gray-500 capitalize">
                        {status.toLowerCase().replace('_', ' ')}
                      </dt>
                      <dd className="font-semibold text-gray-900">{count}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            )}
          </div>

          {/* A/B Test Results */}
          {abTest && abTest.campaign.abTestEnabled && abTest.variants.length > 0 && (
            <div className="lg:col-span-3">
              <Card padding="md">
                <CardHeader>
                  <CardTitle>A/B Test Results</CardTitle>
                  <span className="text-sm text-gray-500">Variant performance comparison</span>
                </CardHeader>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="text-left py-2 px-3 text-gray-400 font-medium">Variant</th>
                        <th className="text-right py-2 px-3 text-gray-400 font-medium">Leads</th>
                        <th className="text-right py-2 px-3 text-gray-400 font-medium">Sent</th>
                        <th className="text-right py-2 px-3 text-gray-400 font-medium">Open Rate</th>
                        <th className="text-right py-2 px-3 text-gray-400 font-medium">Click Rate</th>
                        <th className="text-right py-2 px-3 text-gray-400 font-medium">Reply Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {abTest.variants.map(v => {
                        const isWinner = abTest.variants.length === 2 &&
                          parseFloat(v.replyRate) === Math.max(...abTest.variants.map(x => parseFloat(x.replyRate)));
                        return (
                          <tr key={v.variant} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                            <td className="py-3 px-3">
                              <span className={`inline-flex items-center gap-1.5 font-semibold ${v.variant === 'A' ? 'text-brand-400' : 'text-purple-400'}`}>
                                Variant {v.variant}
                                {isWinner && <span className="text-xs bg-green-900/30 text-green-400 border border-green-500/20 px-1.5 py-0.5 rounded">Winner</span>}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right text-gray-300">{v.leads}</td>
                            <td className="py-3 px-3 text-right text-gray-300">{v.sent}</td>
                            <td className="py-3 px-3 text-right text-gray-300">{v.openRate}%</td>
                            <td className="py-3 px-3 text-right text-gray-300">{v.clickRate}%</td>
                            <td className={`py-3 px-3 text-right font-semibold ${isWinner ? 'text-green-400' : 'text-gray-300'}`}>{v.replyRate}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* Campaign Leads Table */}
          {campaign.campaignLeads && campaign.campaignLeads.length > 0 && (
            <div className="lg:col-span-3">
              <Card padding="md">
                <CardHeader>
                  <CardTitle>Enrolled Leads</CardTitle>
                  <span className="text-sm text-gray-500">{campaign._count?.campaignLeads ?? campaign.campaignLeads.length} total</span>
                </CardHeader>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="text-left py-2 px-3 text-gray-400 font-medium">Lead</th>
                        <th className="text-left py-2 px-3 text-gray-400 font-medium">Company</th>
                        <th className="text-center py-2 px-3 text-gray-400 font-medium">Step</th>
                        <th className="text-center py-2 px-3 text-gray-400 font-medium">Status</th>
                        <th className="text-right py-2 px-3 text-gray-400 font-medium">Score</th>
                        <th className="text-right py-2 px-3 text-gray-400 font-medium">Next Send</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(campaign.campaignLeads as unknown as CampaignLead[])
                        .slice(leadsPage * 20, leadsPage * 20 + 20)
                        .map(cl => (
                          <tr key={cl.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                            <td className="py-2.5 px-3">
                              <Link href={`/inbox?leadId=${cl.lead.id}`} className="hover:text-brand-400 transition-colors">
                                <span className="font-medium text-white">{cl.lead.firstName} {cl.lead.lastName}</span>
                                {cl.lead.email && <div className="text-xs text-gray-500">{cl.lead.email}</div>}
                              </Link>
                            </td>
                            <td className="py-2.5 px-3 text-gray-400">{cl.lead.company ?? '—'}</td>
                            <td className="py-2.5 px-3 text-center text-gray-300">{cl.currentStep + 1}</td>
                            <td className="py-2.5 px-3 text-center">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[cl.status] ?? 'bg-gray-700 text-gray-300'}`}>
                                {cl.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <span className={`text-xs font-semibold ${cl.lead.score >= 70 ? 'text-green-400' : cl.lead.score >= 40 ? 'text-yellow-400' : 'text-gray-500'}`}>
                                {cl.lead.score}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right text-xs text-gray-500">
                              {cl.nextSendAt ? new Date(cl.nextSendAt).toLocaleDateString() : '—'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {(campaign.campaignLeads as unknown as CampaignLead[]).length > 20 && (
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-800">
                    <span className="text-xs text-gray-500">
                      Showing {leadsPage * 20 + 1}–{Math.min((leadsPage + 1) * 20, (campaign.campaignLeads as unknown as CampaignLead[]).length)} of {(campaign.campaignLeads as unknown as CampaignLead[]).length}
                    </span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" disabled={leadsPage === 0} onClick={() => setLeadsPage(p => p - 1)}>Prev</Button>
                      <Button size="sm" variant="ghost" disabled={(leadsPage + 1) * 20 >= (campaign.campaignLeads as unknown as CampaignLead[]).length} onClick={() => setLeadsPage(p => p + 1)}>Next</Button>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
