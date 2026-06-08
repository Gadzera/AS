'use client';

import { useState, type ReactNode } from 'react';
import clsx from 'clsx';
import {
  Building,
  Calendar,
  ChevronDown,
  DollarSign,
  FileText,
  Globe,
  Linkedin,
  ListPlus,
  MapPin,
  Plus,
  Tag,
  TrendingUp,
  Twitter,
  Users,
  Facebook,
} from 'lucide-react';
import type { Lead } from '@/types';

interface RightPanelProps {
  lead: Lead;
  className?: string;
}

interface SectionProps {
  title: string;
  defaultOpen?: boolean;
  onAdd?: () => void;
  children: ReactNode;
}

function Section({ title, defaultOpen = true, onAdd, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[var(--border)]">
      <div
        className="h-9 px-4 flex items-center gap-2 cursor-pointer select-none hover:bg-[var(--surface-2)] transition-colors duration-100"
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronDown
          size={12}
          strokeWidth={2}
          className={clsx(
            'text-[var(--text-subtle)] transition-transform duration-100 shrink-0',
            !open && '-rotate-90',
          )}
        />
        <h2 className="text-[13.5px] font-semibold text-[var(--text)] flex-1 truncate">
          {title}
        </h2>
        {onAdd && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAdd(); }}
            aria-label={`Add ${title.toLowerCase()}`}
            className="w-6 h-6 inline-flex items-center justify-center rounded text-[var(--text-subtle)] hover:text-[var(--text)] hover:bg-[var(--surface-3)] transition-colors duration-100"
          >
            <Plus size={12} strokeWidth={1.75} />
          </button>
        )}
      </div>
      {open && <div className="px-4 py-1 pb-3">{children}</div>}
    </div>
  );
}

function Row({
  icon,
  label,
  children,
  placeholder,
}: {
  icon: ReactNode;
  label: string;
  children?: ReactNode;
  placeholder?: string;
}) {
  const hasValue = children !== undefined && children !== null && children !== '' && children !== false;
  return (
    <div className="h-8 flex items-center gap-3">
      <span className="text-[var(--text-subtle)] shrink-0 inline-flex items-center justify-center w-3.5">
        {icon}
      </span>
      <span className="text-[12px] font-medium text-[var(--text-subtle)] w-24 shrink-0">
        {label}
      </span>
      <span className="text-[13px] text-[var(--text)] truncate flex-1 min-w-0">
        {hasValue ? (
          children
        ) : (
          <span className="text-[var(--text-subtle)]">{placeholder ?? `Set ${label.toLowerCase()}…`}</span>
        )}
      </span>
    </div>
  );
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-[var(--text)] hover:underline underline-offset-2 truncate"
    >
      {children}
    </a>
  );
}

function categoryColor(industry: string | null | undefined): {
  label: string;
  bg: string;
  ink: string;
} | null {
  if (!industry) return null;
  const lc = industry.toLowerCase();
  if (lc.includes('saas') || lc.includes('software')) return { label: industry, bg: 'var(--tag-violet)', ink: 'var(--tag-violet-ink)' };
  if (lc.includes('finance') || lc.includes('fintech') || lc.includes('bank')) return { label: industry, bg: 'var(--tag-blue)', ink: 'var(--tag-blue-ink)' };
  if (lc.includes('market')) return { label: industry, bg: 'var(--tag-pink)', ink: 'var(--tag-pink-ink)' };
  if (lc.includes('health')) return { label: industry, bg: 'var(--tag-green)', ink: 'var(--tag-green-ink)' };
  if (lc.includes('retail') || lc.includes('ecom')) return { label: industry, bg: 'var(--tag-orange)', ink: 'var(--tag-orange-ink)' };
  return { label: industry, bg: 'var(--tag-gray)', ink: 'var(--tag-gray-ink)' };
}

function MiniTag({ label, bg, ink }: { label: string; bg: string; ink: string }) {
  return (
    <span
      className="inline-flex items-center h-5 px-1.5 rounded-sm text-[11px] font-medium leading-none whitespace-nowrap"
      style={{ backgroundColor: bg, color: ink }}
    >
      {label}
    </span>
  );
}

export default function RightPanel({ lead, className }: RightPanelProps) {
  const cat = categoryColor(lead.industry);
  const websiteHost = (() => {
    if (!lead.website) return null;
    try {
      const u = new URL(lead.website.startsWith('http') ? lead.website : `https://${lead.website}`);
      return u.hostname.replace(/^www\./, '');
    } catch {
      return lead.website;
    }
  })();

  return (
    <aside
      className={clsx(
        'w-80 shrink-0 border-l border-[var(--border)] bg-white overflow-y-auto',
        className,
      )}
    >
      <Section title="Record Details" defaultOpen>
        <Row icon={<Globe size={14} strokeWidth={1.75} />} label="Domains">
          {websiteHost ? (
            <ExternalLink href={lead.website?.startsWith('http') ? lead.website : `https://${lead.website}`}>
              {websiteHost}
            </ExternalLink>
          ) : null}
        </Row>
        <Row icon={<FileText size={14} strokeWidth={1.75} />} label="Description">
          {lead.notes ? (
            <span className="block truncate" title={lead.notes}>
              {lead.notes.length > 50 ? lead.notes.slice(0, 48) + '…' : lead.notes}
            </span>
          ) : null}
        </Row>
        <Row icon={<Tag size={14} strokeWidth={1.75} />} label="Categories">
          {cat ? (
            <span className="flex flex-wrap gap-1 items-center">
              <MiniTag label="B2B" bg="var(--tag-gray)" ink="var(--tag-gray-ink)" />
              <MiniTag label={cat.label} bg={cat.bg} ink={cat.ink} />
            </span>
          ) : null}
        </Row>
        <Row icon={<Linkedin size={14} strokeWidth={1.75} />} label="LinkedIn">
          {lead.linkedinUrl ? (
            <ExternalLink href={lead.linkedinUrl}>View profile</ExternalLink>
          ) : null}
        </Row>
      </Section>

      <Section title="Enriched Firmographics" defaultOpen>
        <Row icon={<Calendar size={14} strokeWidth={1.75} />} label="Founded">
          {lead.enriched ? <span className="tabular-nums">2018</span> : null}
        </Row>
        <Row icon={<Users size={14} strokeWidth={1.75} />} label="Employees">
          {lead.companySize ? (
            <span className="tabular-nums">{lead.companySize}</span>
          ) : null}
        </Row>
        <Row icon={<DollarSign size={14} strokeWidth={1.75} />} label="Est. ARR">
          {lead.enriched ? <span className="tabular-nums">$10M – $50M</span> : null}
        </Row>
        <Row icon={<TrendingUp size={14} strokeWidth={1.75} />} label="Funding">
          {lead.enriched ? <span className="tabular-nums">$50M</span> : null}
        </Row>
      </Section>

      <Section title="Location" defaultOpen>
        <Row icon={<MapPin size={14} strokeWidth={1.75} />} label="City">
          {lead.city || null}
        </Row>
        <Row icon={<MapPin size={14} strokeWidth={1.75} />} label="Country">
          {lead.country || null}
        </Row>
      </Section>

      <Section title="Social Media" defaultOpen={false}>
        <Row icon={<Linkedin size={14} strokeWidth={1.75} />} label="LinkedIn">
          {lead.linkedinUrl ? (
            <ExternalLink href={lead.linkedinUrl}>{lead.linkedinUrl.replace(/^https?:\/\//, '')}</ExternalLink>
          ) : null}
        </Row>
        <Row icon={<Twitter size={14} strokeWidth={1.75} />} label="Twitter" />
        <Row icon={<Facebook size={14} strokeWidth={1.75} />} label="Facebook" />
        <Row icon={<Building size={14} strokeWidth={1.75} />} label="AngelList" />
      </Section>

      <Section title="Lists" defaultOpen={false} onAdd={() => { /* placeholder */ }}>
        <button
          type="button"
          className="w-full h-8 px-2 flex items-center gap-2 rounded text-[13px] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors duration-100"
        >
          <ListPlus size={14} strokeWidth={1.75} />
          Add to list
        </button>
      </Section>
    </aside>
  );
}
