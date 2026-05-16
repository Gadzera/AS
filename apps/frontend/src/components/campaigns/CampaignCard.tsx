import type { Campaign } from '@/types';
import Card from '@/components/ui/Card';
import { CampaignStatusBadge } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Link from 'next/link';

interface CampaignCardProps {
  campaign: Campaign;
  onStart?: (id: string) => void;
  onPause?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  duplicating?: boolean;
}

export default function CampaignCard({ campaign, onStart, onPause, onDuplicate, duplicating }: CampaignCardProps) {
  const channelIcon = campaign.channel === 'EMAIL' ? '📧' : '💼';

  return (
    <Card padding="md" hover>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-base">{channelIcon}</span>
            <h3 className="font-semibold text-white truncate text-sm">{campaign.name}</h3>
          </div>
          <div className="flex items-center gap-2">
            <CampaignStatusBadge status={campaign.status} />
            <span className="text-xs text-gray-600">
              {campaign._count?.campaignLeads ?? 0} leads · {campaign._count?.sequences ?? 0} steps
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-1 text-xs text-gray-500 mb-4">
        {campaign.targetIndustry && (
          <p><span className="text-gray-600">Industry:</span> {campaign.targetIndustry}</p>
        )}
        {campaign.targetCountry && (
          <p><span className="text-gray-600">Country:</span> {campaign.targetCountry}</p>
        )}
        {campaign.targetSize && (
          <p><span className="text-gray-600">Size:</span> {campaign.targetSize}</p>
        )}
        <p><span className="text-gray-600">Daily limit:</span> {campaign.dailyLimit} emails</p>
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-gray-800/60">
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
        {onDuplicate && (
          <Button size="sm" variant="ghost" onClick={() => onDuplicate(campaign.id)} disabled={duplicating}>
            {duplicating ? '...' : 'Duplicate'}
          </Button>
        )}
      </div>
    </Card>
  );
}
