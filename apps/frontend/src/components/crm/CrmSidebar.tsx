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
        'group flex h-8 items-center gap-2 rounded-md px-2 text-[13px] leading-none transition-colors',
        active
          ? 'bg-gray-200/80 text-gray-950'
          : 'text-gray-700 hover:bg-gray-100 hover:text-gray-950',
      ].join(' ')}
    >
      <Icon className="h-4 w-4 shrink-0 text-gray-500 group-hover:text-gray-700" />
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
    <aside className="flex h-screen w-[220px] shrink-0 flex-col border-r border-gray-200 bg-[#fbfbfa] text-gray-800">
      <div className="flex h-12 items-center justify-between border-b border-gray-200 px-3">
        <Link href="/crm" className="flex min-w-0 items-center gap-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gray-950 text-[11px] font-semibold text-white">
            AI
          </div>
          <span className="truncate text-[14px] font-medium text-gray-900">Basepoint</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-500" />
        </Link>

        <button
          type="button"
          className="rounded-md border border-gray-200 bg-white p-1 text-gray-500 shadow-sm hover:bg-gray-50"
          aria-label="Toggle sidebar"
        >
          <LayoutGrid className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        <div className="mb-2 flex items-center gap-1.5">
          <Link
            href="#"
            className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border border-gray-200 bg-white px-2 text-[13px] text-gray-800 shadow-sm hover:bg-gray-50"
          >
            <Sparkles className="h-3.5 w-3.5 text-gray-500" />
            <span className="truncate">Quick actions</span>
            <kbd className="ml-auto rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] text-gray-500">
              ⌘K
            </kbd>
          </Link>

          <Link
            href="#"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 shadow-sm hover:bg-gray-50"
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
          <div className="mb-1.5 flex items-center gap-1 px-2 text-[11px] font-medium uppercase tracking-wide text-gray-500">
            <ChevronDown className="h-3 w-3" />
            <span>Favorites</span>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center gap-1 px-2 text-[11px] font-medium uppercase tracking-wide text-gray-500">
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
          <div className="mb-1.5 flex items-center gap-1 px-2 text-[11px] font-medium uppercase tracking-wide text-gray-500">
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

      <div className="border-t border-gray-200 px-3 py-2">
        <div className="flex items-center gap-2 rounded-md px-1 py-1">
          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-gray-200 to-gray-300" />
          <div className="min-w-0">
            <p className="truncate text-[12px] font-medium text-gray-900">AISDR workspace</p>
            <p className="truncate text-[11px] text-gray-500">Flexible CRM</p>
          </div>
        </div>
      </div>
    </aside>
  );
}