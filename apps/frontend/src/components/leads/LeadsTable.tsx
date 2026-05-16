'use client';

import { Lead } from '@/types';
import { LeadStatusBadge, ScoreBadge } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';

interface LeadsTableProps {
  leads: Lead[];
  onAddToCampaign?: (lead: Lead) => void;
  onGenerateOutreach?: (lead: Lead) => void;
  onView?: (lead: Lead) => void;
}

export default function LeadsTable({
  leads,
  onAddToCampaign,
  onGenerateOutreach,
  onView,
}: LeadsTableProps) {
  if (leads.length === 0) {
    return (
      <div className="text-center py-12 text-gray-600">
        <svg className="w-10 h-10 mx-auto mb-3 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <p className="font-medium text-gray-400">No leads found</p>
        <p className="text-sm mt-1 text-gray-600">Import a CSV or add leads manually</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-gray-800">
            <th className="pb-3 pr-4 font-medium text-gray-500 whitespace-nowrap text-xs uppercase tracking-wide">Name</th>
            <th className="pb-3 pr-4 font-medium text-gray-500 whitespace-nowrap text-xs uppercase tracking-wide">Company</th>
            <th className="pb-3 pr-4 font-medium text-gray-500 whitespace-nowrap text-xs uppercase tracking-wide">Title</th>
            <th className="pb-3 pr-4 font-medium text-gray-500 whitespace-nowrap text-xs uppercase tracking-wide">Score</th>
            <th className="pb-3 pr-4 font-medium text-gray-500 whitespace-nowrap text-xs uppercase tracking-wide">Status</th>
            <th className="pb-3 pr-4 font-medium text-gray-500 whitespace-nowrap text-xs uppercase tracking-wide">Country</th>
            <th className="pb-3 font-medium text-gray-500 whitespace-nowrap text-xs uppercase tracking-wide">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/60">
          {leads.map((lead) => (
            <tr key={lead.id} className="hover:bg-gray-800/30 transition-colors">
              <td className="py-3 pr-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-gradient-to-br from-brand-500/20 to-purple-500/20 text-brand-400 border border-brand-500/20 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                    {lead.firstName.charAt(0)}{lead.lastName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-100 whitespace-nowrap">
                      {lead.firstName} {lead.lastName}
                    </p>
                    {lead.email && (
                      <p className="text-xs text-gray-500 truncate max-w-[180px]">{lead.email}</p>
                    )}
                  </div>
                </div>
              </td>
              <td className="py-3 pr-4">
                <p className="text-gray-300 whitespace-nowrap">{lead.company ?? '—'}</p>
                {lead.companySize && (
                  <p className="text-xs text-gray-600">{lead.companySize} emp.</p>
                )}
              </td>
              <td className="py-3 pr-4">
                <p className="text-gray-400 whitespace-nowrap max-w-[160px] truncate">
                  {lead.title ?? '—'}
                </p>
              </td>
              <td className="py-3 pr-4">
                <ScoreBadge score={lead.score} />
              </td>
              <td className="py-3 pr-4">
                <LeadStatusBadge status={lead.status} />
              </td>
              <td className="py-3 pr-4 text-gray-500 whitespace-nowrap">
                {lead.country ?? '—'}
              </td>
              <td className="py-3">
                <div className="flex items-center gap-1">
                  {onView && (
                    <Button size="sm" variant="ghost" onClick={() => onView(lead)}>
                      View
                    </Button>
                  )}
                  {onGenerateOutreach && (
                    <Button size="sm" variant="ghost" onClick={() => onGenerateOutreach(lead)}>
                      AI Write
                    </Button>
                  )}
                  {onAddToCampaign && (
                    <Button size="sm" variant="ghost" onClick={() => onAddToCampaign(lead)}>
                      + Campaign
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
