'use client';

import { useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';

const POSTHOG_KEY  = process.env.NEXT_PUBLIC_POSTHOG_KEY  ?? '';
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://app.posthog.com';

if (typeof window !== 'undefined' && POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    api_host:             POSTHOG_HOST,
    capture_pageview:     false, // manual below
    capture_pageleave:    true,
    autocapture:          false, // avoid noise
    persistence:          'localStorage',
    disable_session_recording: true,
  });
}

function PageviewTracker() {
  const pathname      = usePathname();
  const searchParams  = useSearchParams();

  useEffect(() => {
    if (!POSTHOG_KEY) return;
    const url = pathname + (searchParams.toString() ? `?${searchParams}` : '');
    posthog.capture('$pageview', { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  if (!POSTHOG_KEY) return <>{children}</>;

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      {children}
    </PHProvider>
  );
}
