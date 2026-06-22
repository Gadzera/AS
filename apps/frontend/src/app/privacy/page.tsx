import Link from 'next/link';
import { Zap, ArrowLeft } from 'lucide-react';

/* /privacy — Политика конфиденциальности. Реальная страница (не 404). Ссылается
   отсюда Register/Login и страница Terms. */

export const metadata = { title: 'Privacy Policy · AISDR Agent' };

const SECTIONS: { h: string; p: string }[] = [
  { h: '1. Какие данные мы собираем', p: 'Учётные данные (имя, рабочий email, организация), данные вашего workspace (записи, контакты, переписка, заметки, звонки) и технические логи использования Сервиса.' },
  { h: '2. Как мы их используем', p: 'Только для предоставления и улучшения Сервиса: аутентификация, обработка записей, AI-обогащение, исходящие коммуникации, аналитика по вашему workspace. Мы не продаём ваши данные третьим лицам.' },
  { h: '3. AI-обработка', p: 'Для AI-функций текст записей может передаваться LLM-провайдеру для генерации результата. В демо-режиме обработка детерминированная и локальная, без внешних ключей.' },
  { h: '4. Хранение и доступ', p: 'Данные изолированы по организации (multi-tenant): пользователи видят только данные своего workspace согласно ролям и правам (RBAC). Доступ ограничивается уровнями No access / Read / Read+write / Full.' },
  { h: '5. Письма и календарь', p: 'При подключении почтового ящика/календаря (внешняя интеграция, подключается отдельно) мы синхронизируем переписку и встречи в соответствии с настройками приватности (private / shared).' },
  { h: '6. Ваши права', p: 'Вы можете запросить экспорт или удаление данных вашей организации. Удаление аккаунта удаляет связанные записи в установленные сроки.' },
  { h: '7. Безопасность', p: 'Пароли хранятся в виде bcrypt-хэшей, доступ — по JWT. Поддерживаются 2FA/SSO на уровне настроек безопасности (по плану).' },
  { h: '8. Контакты и изменения', p: 'Политика может обновляться; дата редакции указана ниже. По вопросам конфиденциальности обращайтесь через настройки workspace.' },
];

export default function PrivacyPage() {
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
          <h1 className="mb-1.5 text-[30px] font-extrabold tracking-[-0.025em] text-ink">Политика конфиденциальности</h1>
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
            См. также{' '}
            <Link href="/terms" className="font-medium text-brand-700 hover:underline">Условия использования</Link>{' '}
            или{' '}
            <Link href="/login" className="font-medium text-brand-700 hover:underline">войти в аккаунт</Link>.
          </div>
        </div>
      </div>
    </div>
  );
}
