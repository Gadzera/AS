import type { LeadStatus } from '@/types';
import type { TagColor } from '@/components/ui/Tag';

/**
 * Map a free-form industry string to a Tag color.
 * Keywords are matched case-insensitively in priority order.
 */
export function industryColor(industry: string | null | undefined): TagColor {
  if (!industry) return 'gray';
  const v = industry.toLowerCase();

  if (v.includes('saas')) return 'violet';
  if (v.includes('marketing') || v.includes('advertis')) return 'pink';
  if (v.includes('finance') || v.includes('payment') || v.includes('bank') || v.includes('fintech'))
    return 'blue';
  if (v.includes('data') || v.includes('analytic')) return 'yellow';
  if (v.includes('devtool') || v.includes('developer') || v.includes('tech') || v.includes('software'))
    return 'orange';
  if (v.includes('sales') || v.includes('crm')) return 'green';
  return 'gray';
}

export type StatusDotVariant =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'gray'
  | 'brand';

export function statusDotVariant(status: LeadStatus | string): StatusDotVariant {
  switch (status) {
    case 'NEW':          return 'gray';
    case 'CONTACTED':    return 'info';
    case 'REPLIED':      return 'info';
    case 'HOT':          return 'warning';
    case 'CONVERTED':    return 'success';
    case 'LOST':         return 'danger';
    case 'UNSUBSCRIBED': return 'gray';
    default:             return 'gray';
  }
}

export function statusLabel(status: LeadStatus | string): string {
  const s = String(status);
  if (!s) return '—';
  return s.charAt(0) + s.slice(1).toLowerCase();
}
