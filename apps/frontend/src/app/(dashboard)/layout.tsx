import Sidebar from '@/components/layout/Sidebar';
import { SelectionProvider } from '@/lib/selection';
import ComposeEmailModalRoot from '@/components/email/ComposeEmailModal';
import CommandPalette from '@/components/layout/CommandPalette';
import ThemeBoot from '@/components/layout/ThemeBoot';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SelectionProvider>
      <ThemeBoot />
      <div className="flex min-h-screen bg-[var(--bg)]">
        <Sidebar />
        <main className="flex-1 flex flex-col min-w-0">{children}</main>
      </div>
      <ComposeEmailModalRoot />
      <CommandPalette />
    </SelectionProvider>
  );
}
