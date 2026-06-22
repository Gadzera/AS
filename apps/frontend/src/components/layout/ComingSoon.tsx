'use client';

import { type ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import Topbar from '@/components/layout/Topbar';

interface ComingSoonProps {
  title: string;
  icon: ReactNode;
  purpose: string;
  /** что пользователь будет делать на этом экране (по новой IA) */
  bullets: string[];
}

// Заглушка экрана из новой IA: коммуницирует назначение, пока экран строится.
export default function ComingSoon({ title, icon, purpose, bullets }: ComingSoonProps) {
  return (
    <>
      <Topbar title={title} icon={icon} />

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-xl rounded-2xl border border-line bg-surface p-8 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="brand-gradient flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-brand ring-1 ring-white/40">
              {icon}
            </span>
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-700 ring-1 ring-inset ring-brand-100">
                <Sparkles size={12} /> In design
              </div>
              <h1 className="mt-1.5 text-[22px] font-extrabold tracking-[-0.02em] text-ink">{title}</h1>
            </div>
          </div>

          <p className="mt-4 text-[14px] leading-6 text-ink-muted">{purpose}</p>

          <div className="mt-5 space-y-2">
            {bullets.map((b) => (
              <div key={b} className="flex items-start gap-2.5 rounded-xl border border-line bg-surface-2/50 px-3.5 py-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full brand-gradient" />
                <p className="text-[13px] leading-5 text-ink">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
