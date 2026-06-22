'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Bell,
  BriefcaseBusiness,
  Building2,
  CheckSquare,
  ChevronDown,
  CircleDot,
  FileText,
  Inbox,
  LayoutGrid,
  ListChecks,
  Mail,
  Megaphone,
  MessageSquareText,
  Phone,
  Receipt,
  Search,
  Settings,
  Sparkles,
  SquareKanban,
  UsersRound,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { listObjects, type CrmObject } from '@/lib/crmApi';

interface StaticNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const mainNavItems: StaticNavItem[] = [
  { label: 'Notifications', href: '#', icon: Bell },
  { label: 'Tasks', href: '#', icon: CheckSquare },
  { label: 'Notes', href: '#', icon: FileText },
  { label: 'Emails', href: '#', icon: Mail },
  { label: 'Calls', href: '#', icon: Phone },
  { label: 'Reports', href: '#', icon: SquareKanban },
  { label: 'Automations', href: '#', icon: Zap },
];

const listItems: StaticNavItem[] = [
  { label: 'Inbound Leads', href: '#', icon: Inbox },
  { label: 'Recruiting', href: '#', icon: Search },
  { label: 'Event Invitees', href: '#', icon: Mail },
  { label: 'Customer Success', href: '#', icon: ListChecks },
  { label: 'Onboarding Pipeline', href: '#', icon: Megaphone },
  { label: 'PQL', href: '#', icon: Sparkles },
];

function getObjectIcon(icon: string | null | undefined, key: string): LucideIcon {
  const value = `${icon ?? ''} ${key}`.toLowerCase();

  if (value.includes('compan') || value.includes('building')) return Building2;
  if (value.includes('people') || value.includes('person') || value.includes('user')) return UsersRound;
  if (value.includes('deal') || value.includes('pipeline')) return BriefcaseBusiness;
  if (value.includes('invoice') || value.includes('receipt')) return Receipt;
  if (value.includes('workspace')) return LayoutGrid;

  return CircleDot;
}

function SidebarItem({
  href,
  icon: Icon,
  label,
  active = false,
  children,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active?: boolean;
  children?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={[
        'group relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-all duration-200 ease-out',
        active
          ? 'sidebar-active-gradient text-ink shadow-xs ring-1 ring-brand-100 before:absolute before:left-0 before:top-2 before:h-5 before:w-0.5 before:rounded-full before:bg-brand-600'
          : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
      ].join(' ')}
    >
      <Icon className={['h-4 w-4 shrink-0 transition-colors', active ? 'text-brand-600' : 'text-ink-subtle group-hover:text-brand-600'].join(' ')} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {children}
    </Link>
  );
}

export default function CrmSidebar() {
  const pathname = usePathname();
  const [objects, setObjects] = useState<CrmObject[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function loadObjects() {
      try {
        const data = await listObjects();

        if (isMounted) {
          setObjects(data);
        }
      } catch {
        if (isMounted) {
          setObjects([]);
        }
      }
    }

    loadObjects();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <aside className="flex h-screen w-[240px] shrink-0 flex-col border-r border-line/80 bg-[var(--sidebar)] text-ink">
      <div className="flex h-14 items-center justify-between border-b border-line/80 px-3">
        <Link href="/crm" className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg brand-gradient text-[12px] font-bold text-white shadow-md ring-1 ring-white/60">
            A
          </div>
          <span className="truncate text-sm font-semibold tracking-[-0.01em] text-ink">Basepoint</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-subtle" />
        </Link>

        <button
          type="button"
          className="rounded-lg border border-line bg-surface p-1.5 text-ink-subtle shadow-xs transition-colors hover:bg-surface-2 hover:text-ink"
          aria-label="Toggle sidebar"
        >
          <LayoutGrid className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        <div className="mb-2 flex items-center gap-1.5">
          <Link
            href="#"
            className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-sm text-ink-muted shadow-xs transition-all hover:bg-surface-2 hover:text-ink hover:border-line-strong"
          >
            <Sparkles className="h-4 w-4 text-brand-500" />
            <span className="truncate">Quick actions</span>
            <kbd className="ml-auto rounded border border-line bg-surface-2 px-1.5 py-0.5 text-[10px] text-ink-subtle">
              ⌘K
            </kbd>
          </Link>

          <Link
            href="#"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-ink-subtle shadow-xs transition-all hover:bg-surface-2 hover:text-ink hover:border-line-strong"
            aria-label="Search"
          >
            <Search className="h-3.5 w-3.5" />
          </Link>
        </div>

        <nav className="space-y-0.5">
          {mainNavItems.map((item) => (
            <SidebarItem key={item.label} href={item.href} icon={item.icon} label={item.label} />
          ))}
        </nav>

        <div className="mt-5">
          <div className="mb-2 flex items-center gap-1 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
            <ChevronDown className="h-3 w-3" />
            <span>Favorites</span>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center gap-1 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
            <ChevronDown className="h-3 w-3" />
            <span>Records</span>
          </div>

          <nav className="space-y-0.5">
            {objects.map((object) => {
              const Icon = getObjectIcon(object.icon, object.key);
              const href = `/crm/${object.key}`;
              const active = pathname === href || pathname.startsWith(`${href}/`);

              return (
                <SidebarItem
                  key={object.id}
                  href={href}
                  icon={Icon}
                  label={object.pluralName}
                  active={active}
                />
              );
            })}
          </nav>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center gap-1 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
            <ChevronDown className="h-3 w-3" />
            <span>Lists</span>
          </div>

          <nav className="space-y-0.5">
            {listItems.map((item) => (
              <SidebarItem key={item.label} href={item.href} icon={item.icon} label={item.label} />
            ))}

            <SidebarItem href="#" icon={CircleDot} label="All lists" />
          </nav>
        </div>
      </div>

      <div className="border-t border-line/80 px-2 py-2">
        <SidebarItem
          href="/crm/settings/data/objects"
          icon={Settings}
          label="Settings / Data"
          active={pathname.startsWith('/crm/settings')}
        />
        <div className="mt-2 flex items-center gap-2.5 rounded-xl border border-line bg-white/70 px-2.5 py-2 shadow-xs">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg brand-gradient text-[11px] font-bold text-white shadow-sm ring-1 ring-white/60">
            AI
          </div>
          <div className="min-w-0">
            <p className="truncate text-[12px] font-semibold text-ink">AISDR workspace</p>
            <p className="truncate text-[11px] text-ink-muted">Flexible CRM</p>
          </div>
        </div>
      </div>
    </aside>
  );
}