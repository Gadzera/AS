'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { overviewApi, type OnboardingState } from '@/lib/api';
import { Rocket, Check, ArrowRight, Mailbox, Users, Workflow, CalendarClock, X } from 'lucide-react';

/* Onboarding-чек-лист первичной настройки. На ЖИВЫХ счётчиках: подключить ящик → добавить лидов →
   создать sequence → подключить календарь. Показывается, пока настройка не завершена. */

const STEP_ICON: Record<string, React.ReactNode> = {
  mailbox: <Mailbox size={15} />, leads: <Users size={15} />, sequence: <Workflow size={15} />, calendar: <CalendarClock size={15} />,
};

export default function OnboardingChecklist() {
  const router = useRouter();
  const [data, setData] = useState<OnboardingState | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    overviewApi.onboarding().then(setData).catch(() => {});
    setDismissed(typeof window !== 'undefined' && sessionStorage.getItem('onboarding:dismissed') === '1');
  }, []);

  if (!data || data.complete || dismissed) return null;
  const pct = Math.round((data.completed / data.total) * 100);

  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-brand-200 bg-[linear-gradient(135deg,rgba(79,70,229,0.06),rgba(217,70,239,0.05))] shadow-xs">
      <div className="flex items-start gap-3 px-4 pt-3.5">
        <span className="brand-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-brand"><Rocket size={17} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-[14px] font-bold text-ink">Get your agent live</h3>
            <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-bold text-brand-700">{data.completed}/{data.total} done</span>
          </div>
          <p className="text-[12px] text-ink-muted">A few steps to start autonomous outreach. {data.isNew ? 'Your workspace is empty — nothing is pre-filled.' : ''}</p>
        </div>
        <button type="button" onClick={() => { sessionStorage.setItem('onboarding:dismissed', '1'); setDismissed(true); }} className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-subtle hover:bg-white/60 hover:text-ink" title="Hide"><X size={14} /></button>
      </div>

      <div className="px-4 pt-2">
        <div className="h-1.5 overflow-hidden rounded-full bg-white/60"><div className="h-full rounded-full brand-gradient transition-all" style={{ width: `${pct}%` }} /></div>
      </div>

      <div className="grid grid-cols-1 gap-1.5 p-3 sm:grid-cols-2">
        {data.steps.map((s) => (
          <button key={s.key} type="button" onClick={() => router.push(s.href)}
            className={['group flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors', s.done ? 'border-emerald-200 bg-emerald-50/50' : 'border-line bg-white/70 hover:bg-white'].join(' ')}>
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${s.done ? 'bg-emerald-100 text-emerald-600' : 'bg-brand-50 text-brand-600'}`}>
              {s.done ? <Check size={16} strokeWidth={2.5} /> : STEP_ICON[s.key]}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-[12.5px] font-bold ${s.done ? 'text-emerald-700 line-through decoration-emerald-300' : 'text-ink'}`}>{s.label}</p>
              <p className="truncate text-[11px] text-ink-subtle">{s.done ? 'Done' : s.description}</p>
            </div>
            {!s.done && <ArrowRight size={14} className="shrink-0 text-ink-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600" />}
          </button>
        ))}
      </div>
    </div>
  );
}
