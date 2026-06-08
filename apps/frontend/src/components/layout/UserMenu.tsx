'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, LogOut } from 'lucide-react';
import { getStoredUser, logout } from '@/lib/auth';
import type { User } from '@/types';
import Avatar from '@/components/ui/Avatar';
import Dropdown, { DropdownItem, DropdownSeparator } from '@/components/ui/Dropdown';

export default function UserMenu() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  if (!user) return null;

  return (
    <Dropdown
      align="end"
      trigger={
        <button
          type="button"
          className="inline-flex items-center gap-1.5 h-8 pl-0.5 pr-1.5 rounded-md hover:bg-[var(--surface-2)] transition-colors duration-100"
        >
          <Avatar name={user.name} size={24} />
          <ChevronDown size={12} strokeWidth={1.75} className="text-[var(--text-subtle)]" />
        </button>
      }
      menuClassName="w-[220px]"
    >
      {() => (
        <>
          <div className="px-2.5 py-2">
            <p className="text-[13px] font-medium text-[var(--text)] truncate leading-none">
              {user.name}
            </p>
            <p className="text-[12px] text-[var(--text-muted)] truncate mt-1 leading-none">
              {user.email}
            </p>
          </div>
          <DropdownSeparator />
          <DropdownItem icon={<LogOut size={14} strokeWidth={1.75} />} onClick={logout}>
            Sign out
          </DropdownItem>
        </>
      )}
    </Dropdown>
  );
}
