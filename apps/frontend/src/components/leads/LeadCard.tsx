import type { Lead } from '@/types';
import Card from '@/components/ui/Card';
import { LeadStatusBadge, ScoreBadge } from '@/components/ui/Badge';

interface LeadCardProps {
  lead: Lead;
  onClick?: () => void;
}

export default function LeadCard({ lead, onClick }: LeadCardProps) {
  return (
    <Card
      className={onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}
      padding="md"
    >
      <div onClick={onClick}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold">
              {lead.firstName.charAt(0)}{lead.lastName.charAt(0)}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">
                {lead.firstName} {lead.lastName}
              </h3>
              <p className="text-sm text-ink-muted">{lead.title ?? 'Unknown title'}</p>
            </div>
          </div>
          <ScoreBadge score={lead.score} />
        </div>

        <div className="space-y-1 text-sm text-ink-subtle">
          {lead.company && (
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span>{lead.company}{lead.companySize ? ` · ${lead.companySize}` : ''}</span>
            </div>
          )}
          {lead.email && (
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="truncate">{lead.email}</span>
            </div>
          )}
          {lead.country && (
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{lead.city ? `${lead.city}, ` : ''}{lead.country}</span>
            </div>
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-gray-100">
          <LeadStatusBadge status={lead.status} />
        </div>
      </div>
    </Card>
  );
}
