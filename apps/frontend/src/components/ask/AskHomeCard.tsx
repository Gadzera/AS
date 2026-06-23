'use client';

/* ──────────────────────────────────────────────────────────────────────────
   AskHomeCard (M26-1, S190) — homepage-поверхность Ask AISDR на Cockpit.
   Greeting + «Ask anything…» (точка входа homepage) + recent chats + сегодняшние
   встречи и открытые задачи. Всё реальное (/api/ask/home); пусто → empty-state,
   без fake-карточек (обяз. правка GPT).
   ────────────────────────────────────────────────────────────────────────── */

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { askApi, type AskHome } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { useT } from '@/i18n';
import { Sparkles, SendHorizonal, MessageSquare, CalendarCheck, ListChecks, ShieldCheck } from 'lucide-react';

function fmtWhen(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AskHomeCard() {
  const router = useRouter();
  const t = useT();
  const [home, setHome] = useState<AskHome | null>(null);
  const [q, setQ] = useState('');
  // Приветствие считаем на клиенте (локаль + время суток + имя), а не из серверной строки —
  // так оно переводится. На сервере/до маунта пусто → показываем fallback (без рассинхрона гидратации).
  const [greeting, setGreeting] = useState('');

  useEffect(() => { askApi.home().then(setHome).catch(() => {}); }, []);
  useEffect(() => {
    const name = getStoredUser()?.name?.split(' ')[0]?.trim();
    const h = new Date().getHours();
    const key = h < 12 ? 'greetingMorning' : h < 18 ? 'greetingAfternoon' : 'greetingEvening';
    const g = t(`dashboard.ask.${key}`);
    setGreeting(name ? `${g}, ${name}` : g);
  }, [t]);

  function ask(question: string) {
    const v = question.trim();
    if (!v) return;
    router.push(`/ask?q=${encodeURIComponent(v)}`);
  }

  const starters = [t('dashboard.ask.starter1'), t('dashboard.ask.starter2'), t('dashboard.ask.starter3')];

  return (
    <section className="mb-5 overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-line bg-[linear-gradient(135deg,rgba(79,70,229,0.08),rgba(139,92,246,0.05))] px-5 py-4">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-[16px] font-extrabold tracking-[-0.01em] text-ink">
            <span className="brand-gradient inline-flex h-7 w-7 items-center justify-center rounded-lg text-white"><Sparkles size={15} /></span>
            {greeting || t('dashboard.ask.fallbackTitle')}
          </h3>
          <p className="mt-0.5 text-[12px] text-ink-muted">{t('dashboard.ask.subtitle')}</p>
        </div>
        <span className="hidden shrink-0 items-center gap-1.5 rounded-md bg-surface-2 px-2 py-1 text-[10.5px] font-medium text-emerald-700 sm:inline-flex"><ShieldCheck size={12} /> {t('dashboard.ask.rbacAware')}</span>
      </div>

      <div className="px-5 py-4">
        {/* ask box */}
        <form onSubmit={(e) => { e.preventDefault(); ask(q); }} className="flex items-center gap-2 rounded-xl border border-line bg-surface px-2 py-1.5 shadow-xs focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-100">
          <Sparkles size={15} className="ml-1 shrink-0 text-brand-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('dashboard.ask.placeholder')} className="min-w-0 flex-1 bg-transparent px-1 py-1.5 text-[13.5px] text-ink outline-none placeholder:text-ink-subtle" />
          <button type="submit" disabled={!q.trim()} className={['inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all', q.trim() ? 'brand-gradient text-white shadow-brand' : 'cursor-not-allowed bg-surface-2 text-ink-subtle'].join(' ')}><SendHorizonal size={15} /></button>
        </form>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {starters.map((s) => (
            <button key={s} type="button" onClick={() => ask(s)} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-muted transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"><Sparkles size={10} className="text-brand-400" /> {s}</button>
          ))}
        </div>

        {/* S190: recent chats + today's meetings + open tasks */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <HomeCol icon={<MessageSquare size={12} />} title={t('dashboard.ask.recentChats')} empty={t('dashboard.ask.noChats')}>
            {(home?.recentChats ?? []).slice(0, 3).map((c) => (
              <button key={c.id} type="button" onClick={() => router.push(`/ask?chat=${c.id}`)} className="block w-full truncate rounded-md px-2 py-1 text-left text-[12px] text-ink-muted hover:bg-surface-2 hover:text-ink">{c.title || t('dashboard.ask.newChat')}</button>
            ))}
          </HomeCol>
          <HomeCol icon={<CalendarCheck size={12} />} title={t('dashboard.ask.upcomingMeetings')} empty={t('dashboard.ask.noMeetings')}>
            {(home?.meetings ?? []).slice(0, 3).map((m, i) => (
              <button key={i} type="button" onClick={() => router.push('/meetings')} className="block w-full truncate rounded-md px-2 py-1 text-left text-[12px] text-ink-muted hover:bg-surface-2 hover:text-ink"><span className="font-medium text-ink">{m.title}</span>{m.when ? <span className="text-ink-subtle"> · {fmtWhen(m.when)}</span> : null}</button>
            ))}
          </HomeCol>
          <HomeCol icon={<ListChecks size={12} />} title={t('dashboard.ask.openTasks')} empty={t('dashboard.ask.noTasks')}>
            {(home?.tasks ?? []).slice(0, 3).map((t) => (
              <button key={t.id} type="button" onClick={() => router.push(t.href)} className="block w-full truncate rounded-md px-2 py-1 text-left text-[12px] text-ink-muted hover:bg-surface-2 hover:text-ink">{t.title}</button>
            ))}
          </HomeCol>
        </div>
      </div>
    </section>
  );
}

function HomeCol({ icon, title, empty, children }: { icon: ReactNode; title: string; empty: string; children: ReactNode }) {
  const arr = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];
  const isEmpty = (arr as unknown[]).length === 0;
  return (
    <div className="rounded-xl border border-line bg-surface-2/40 p-2.5">
      <p className="mb-1 inline-flex items-center gap-1.5 px-1 text-[10px] font-bold uppercase tracking-[0.07em] text-ink-subtle"><span className="text-ink-subtle">{icon}</span> {title}</p>
      {isEmpty ? <p className="px-2 py-1 text-[11.5px] text-ink-subtle">{empty}</p> : <div className="space-y-0.5">{children}</div>}
    </div>
  );
}
