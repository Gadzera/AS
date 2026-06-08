'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import CrmSidebar from '@/components/crm/CrmSidebar';
import { bootstrapCrm, getCrmStatus } from '@/lib/crmApi';
import { getToken } from '@/lib/auth';

export default function CrmLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function prepareCrm() {
      const token = getToken();

      if (!token) {
        router.replace('/login');
        return;
      }

      if (isMounted) {
        setIsAuthorized(true);
        setError(null);
      }

      try {
        const status = await getCrmStatus();

        if (!status.hasObjects) {
          await bootstrapCrm();
        }

        if (isMounted) {
          setIsReady(true);
        }
      } catch {
        if (isMounted) {
          setError('Не удалось подготовить CRM. Проверьте API и авторизацию.');
        }
      }
    }

    prepareCrm();

    return () => {
      isMounted = false;
    };
  }, [router]);

  if (!isAuthorized) {
    return <div className="min-h-screen bg-white" />;
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-6 text-gray-900">
        <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-[15px] font-semibold text-gray-950">CRM недоступна</h1>
          <p className="mt-2 text-[13px] leading-5 text-gray-600">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-md bg-blue-600 px-3 py-2 text-[13px] font-medium text-white hover:bg-blue-700"
          >
            Повторить
          </button>
        </div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-[13px] text-gray-600">
        Подготовка CRM…
      </div>
    );
  }

  return (
    <div className="flex h-screen min-h-screen overflow-hidden bg-white text-gray-900">
      <CrmSidebar />
      <main className="min-w-0 flex-1 overflow-hidden bg-white">{children}</main>
    </div>
  );
}