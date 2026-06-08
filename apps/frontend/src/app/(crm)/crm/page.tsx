'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { listObjects } from '@/lib/crmApi';

export default function CrmIndexPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function redirectToFirstObject() {
      try {
        const objects = await listObjects();
        const target = objects.find((object) => object.key === 'companies') ?? objects[0];

        if (!isMounted) return;

        if (target) {
          router.replace(`/crm/${target.key}`);
          return;
        }

        router.replace('/crm/companies');
      } catch {
        if (isMounted) {
          setError('Не удалось найти объекты CRM.');
        }
      }
    }

    redirectToFirstObject();

    return () => {
      isMounted = false;
    };
  }, [router]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-white px-6">
        <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-[15px] font-semibold text-gray-950">CRM не открылась</h1>
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

  return (
    <div className="flex h-full items-center justify-center bg-white text-[13px] text-gray-600">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Открытие CRM…
    </div>
  );
}