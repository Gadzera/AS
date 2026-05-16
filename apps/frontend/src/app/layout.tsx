import type { Metadata } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/ui/Toast';
import PostHogProvider from '@/components/analytics/PostHogProvider';

export const metadata: Metadata = {
  title: 'AI SDR Agent — B2B Sales Automation',
  description: 'AI-powered sales development platform. Find leads, write personalized emails, automate follow-ups.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="bg-[#080b10] text-gray-100 antialiased min-h-screen">
        <PostHogProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
