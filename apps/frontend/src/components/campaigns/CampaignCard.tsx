import type { Campaign } from '@/types';
import Card from '@/components/ui/Card';
import { CampaignStatusBadge } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Link from 'next/link';

interface CampaignCardProps {
  campaign: Campaign;
  onStart?: (id: string) => void;
  onPause?: (id: string) => void;
}

export default function CampaignCard({ campaign, onStart, onPause }: CampaignCardProps) {
  const channelLabel = campaign.channel === 'EMAIL' ? 'Email' : 'LinkedIn';
  const ChannelIcon = campaign.channel === 'EMAIL' ? (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ) : (
    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 11.001-4.12 2.06 2.06 0 010 4.12zM7.12 20.45H3.56V9h3.56v11.45z"/>
    </svg>
  );

  return (
    <Card padding="md" hover>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1 px-1.5 h-5 rounded text-[10px] font-medium text-ink-muted bg-surface-2 border border-line">
              {ChannelIcon}
              {channelLabel}
            </span>
            <h3 className="font-semibold text-ink truncate text-sm">{campaign.name}</h3>
          </div>
          <div className="flex items-center gap-2">
            <CampaignStatusBadge status={campaign.status} />
            <span className="text-xs text-ink-subtle">
              {campaign._count?.campaignLeads ?? 0} leads · {campaign._count?.sequences ?? 0} steps
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-1 text-xs text-ink-muted mb-4">
        {campaign.targetIndustry && (
          <p><span className="text-ink-subtle">Industry:</span> {campaign.targetIndustry}</p>
        )}
        {campaign.targetCountry && (
          <p><span className="text-ink-subtle">Country:</span> {campaign.targetCountry}</p>
        )}
        {campaign.targetSize && (
          <p><span className="text-ink-subtle">Size:</span> {campaign.targetSize}</p>
        )}
        <p><span className="text-ink-subtle">Daily limit:</span> {campaign.dailyLimit} emails</p>
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-line">
        <Link href={`/campaigns/${campaign.id}`}>
          <Button size="sm" variant="secondary">View</Button>
        </Link>
        {campaign.status === 'DRAFT' || campaign.status === 'PAUSED' ? (
          onStart && (
            <Button size="sm" variant="primary" onClick={() => onStart(campaign.id)}>
              Start
            </Button>
          )
        ) : campaign.status === 'ACTIVE' ? (
          onPause && (
            <Button size="sm" variant="secondary" onClick={() => onPause(campaign.id)}>
              Pause
            </Button>
          )
        ) : null}
      </div>
    </Card>
  );
}
