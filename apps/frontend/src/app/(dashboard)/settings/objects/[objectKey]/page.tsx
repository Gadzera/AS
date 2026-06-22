'use client';

// Старый отдельный редактор объекта схлопнут в единый экран Data model.
// Этот роут теперь редиректит на /settings/objects?obj=<key>, чтобы старые ссылки
// (CommandPalette, закладки) не ломались.

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function ObjectRedirect() {
  const params = useParams();
  const router = useRouter();
  const objectKey = params.objectKey as string;

  useEffect(() => {
    router.replace(`/settings/objects?obj=${encodeURIComponent(objectKey)}`);
  }, [objectKey, router]);

  return (
    <div className="flex flex-1 items-center justify-center text-[13px] text-ink-muted">
      <Loader2 size={16} className="mr-2 animate-spin" /> Opening data model…
    </div>
  );
}
