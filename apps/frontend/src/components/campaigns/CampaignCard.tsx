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
  const channelIcon = campaign.channel === 'EMAIL' ? '📧' : '💼';

  return (
    <Card padding="md">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{channelIcon}</span>
            <h3 className="font-semibold text-gray-900 truncate">{campaign.name}</h3>
          </div>
          <div className="flex items-center gap-2">
            <CampaignStatusBadge status={campaign.status} />
            <span className="text-xs text-gray-400">
              {campaign._count?.campaignLeads ?? 0} leads · {campaign._count?.sequences ?? 0} steps
            </span>
          </div>
        </div>
      </div>

      {/* Targets */}
      <div className="space-y-1 text-sm text-gray-500 mb-4">
        {campaign.targetIndustry && (
          <p>
            <span className="font-medium text-gray-700">Industry:</span> {campaign.targetIndustry}
          </p>
        )}
        {campaign.targetCountry && (
          <p>
            <span className="font-medium text-gray-700">Country:</span> {campaign.targetCountry}
          </p>
        )}
        {campaign.targetSize && (
          <p>
            <span className="font-medium text-gray-700">Size:</span> {campaign.targetSize}
          </p>
        )}
        <p>
          <span className="font-medium text-gray-700">Daily limit:</span> {campaign.dailyLimit}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
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
