import Sidebar from '@/components/layout/Sidebar';
import { SelectionProvider } from '@/lib/selection';
import ComposeEmailModalRoot from '@/components/email/ComposeEmailModal';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SelectionProvider>
      <div className="flex min-h-screen bg-[var(--bg)]">
        <Sidebar />
        <main className="flex-1 flex flex-col min-w-0">{children}</main>
      </div>
      <ComposeEmailModalRoot />
    </SelectionProvider>
  );
}
