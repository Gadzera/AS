import Link from 'next/link';
import { Zap, ArrowLeft } from 'lucide-react';

/* /terms — Условия использования. Реальная страница (не 404): рендерится, имеет
   контент и навигацию назад. Ссылается отсюда Register/Login. */

export const metadata = { title: 'Terms of Service · AISDR Agent' };

const SECTIONS: { h: string; p: string }[] = [
  { h: '1. Принятие условий', p: 'Используя AISDR Agent («Сервис»), вы соглашаетесь с настоящими Условиями. Если вы не согласны — не используйте Сервис. Сервис предоставляется организации, от имени которой вы регистрируетесь.' },
  { h: '2. Учётная запись', p: 'Вы отвечаете за сохранность учётных данных и за все действия в рамках вашей организации. Один аккаунт создаёт одну организацию (workspace); вы становитесь её владельцем (OWNER).' },
  { h: '3. Допустимое использование', p: 'Запрещены рассылка спама, нарушение законов о защите данных и попытки обойти лимиты доставляемости. Вы отвечаете за согласие получателей на исходящие коммуникации, инициированные через Сервис.' },
  { h: '4. AI и кредиты', p: 'AI-функции (классификация, саммаризация, ресёрч, генерация) расходуют кредиты по тарифу плана. В демо-режиме AI работает на детерминированных данных без внешних ключей.' },
  { h: '5. Данные', p: 'Вы сохраняете права на загруженные данные (записи, контакты, переписку). Мы обрабатываем их только для предоставления Сервиса. Подробности — в Политике конфиденциальности.' },
  { h: '6. Тарифы и оплата', p: 'Стартовый план — бесплатно. Платные планы тарифицируются по подписке; кредиты сверх пакета — отдельно. Условия могут меняться с уведомлением.' },
  { h: '7. Ограничение ответственности', p: 'Сервис предоставляется «как есть». В пределах, допустимых законом, мы не несём ответственности за косвенные убытки. Демо-режим не предназначен для реальных боевых рассылок.' },
  { h: '8. Изменения', p: 'Мы можем обновлять Условия; продолжение использования Сервиса означает принятие изменений. Дата последней редакции указывается на этой странице.' },
];

export default function TermsPage() {
  return (
    <div className="hero-gradient min-h-screen px-4 py-12">
      <div className="mx-auto w-full max-w-[720px]">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/register" className="inline-flex items-center gap-2 text-[13px] font-medium text-ink-muted hover:text-ink">
            <ArrowLeft size={15} /> Назад к регистрации
          </Link>
          <span className="inline-flex items-center gap-2">
            <span className="brand-gradient flex h-8 w-8 items-center justify-center rounded-xl shadow-brand"><Zap className="text-white" size={15} strokeWidth={2.5} /></span>
            <span className="text-[15px] font-extrabold tracking-[-0.02em] text-ink">AISDR <span className="text-gradient">Agent</span></span>
          </span>
        </div>

        <div className="surface-glass rounded-[24px] p-9">
          <h1 className="mb-1.5 text-[30px] font-extrabold tracking-[-0.025em] text-ink">Условия использования</h1>
          <p className="mb-7 text-[13px] text-ink-subtle">Последняя редакция: 15 июня 2026</p>
          <div className="space-y-5">
            {SECTIONS.map((s) => (
              <section key={s.h}>
                <h2 className="mb-1 text-[15px] font-bold text-ink">{s.h}</h2>
                <p className="text-[13.5px] leading-6 text-ink-muted">{s.p}</p>
              </section>
            ))}
          </div>
          <div className="mt-8 border-t border-line pt-5 text-[13px] text-ink-muted">
            Вопросы по условиям — на{' '}
            <Link href="/privacy" className="font-medium text-brand-700 hover:underline">Политику конфиденциальности</Link>{' '}
            или{' '}
            <Link href="/login" className="font-medium text-brand-700 hover:underline">войти в аккаунт</Link>.
          </div>
        </div>
      </div>
    </div>
  );
}
