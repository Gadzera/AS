'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, MailCheck, Zap } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { authApi } from '@/lib/api';
import { useT } from '@/i18n';

export default function ForgotPasswordPage() {
  const t = useT();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [demoToken, setDemoToken] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Реальный backend: создаёт токен сброса (JWT). Отправка письма — внешний сервис (позже);
      // в демо-режиме ссылка возвращается в ответе (demoToken), чтобы пройти flow.
      const res = await authApi.forgotPassword(email);
      setDemoToken(res.demoToken ?? null);
      setSent(true);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (err instanceof Error ? err.message : t('auth.errors.somethingWrong'));
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="hero-gradient min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[456px]">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <span className="brand-gradient w-12 h-12 rounded-2xl flex items-center justify-center shadow-brand ring-1 ring-white/40">
            <Zap className="text-white" size={22} strokeWidth={2.5} />
          </span>
          <span className="text-[19px] font-extrabold tracking-[-0.02em] text-ink">
            AISDR <span className="text-gradient">Agent</span>
          </span>
        </div>

        <div className="surface-glass rounded-[24px] p-9">
          {sent ? (
            <div className="text-center">
              <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                <MailCheck size={26} strokeWidth={2} />
              </span>
              <h1 className="text-[24px] font-extrabold tracking-[-0.02em] text-ink mb-1.5">{t('auth.forgot.checkEmailTitle')}</h1>
              <p className="text-[14px] text-ink-muted leading-5">
                {t('auth.forgot.checkEmailBodyPrefix')} <span className="font-semibold text-ink">{email}</span> {t('auth.forgot.checkEmailBodySuffix')}
              </p>
              {demoToken && (
                <div className="mt-5 rounded-xl border border-brand-200/70 bg-[linear-gradient(135deg,rgba(79,70,229,0.07),rgba(217,70,239,0.07))] px-3.5 py-3 text-left">
                  <p className="text-[11.5px] font-bold uppercase tracking-[0.05em] text-brand-700">{t('auth.forgot.demoMode')}</p>
                  <p className="mt-1 text-[12.5px] leading-5 text-ink-muted">
                    {t('auth.forgot.demoResetNote')}
                  </p>
                  <Link
                    href={`/reset-password?token=${encodeURIComponent(demoToken)}`}
                    className="mt-2 inline-flex h-8 items-center rounded-lg bg-white/70 px-3 text-[12.5px] font-semibold text-brand-700 ring-1 ring-brand-200/70 transition-colors hover:bg-white hover:text-brand-800"
                  >
                    {t('auth.forgot.openResetLink')}
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <>
              <h1 className="text-[30px] font-extrabold tracking-[-0.025em] text-ink mb-1.5 leading-[1.08]">
                {t('auth.forgot.title')}
              </h1>
              <p className="text-[15px] text-ink-muted mb-7 leading-5">
                {t('auth.forgot.subtitle')}
              </p>

              <form onSubmit={handleSubmit} className="space-y-3">
                {error && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[12.5px] font-medium text-rose-700">
                    {error}
                  </div>
                )}
                <Input
                  label={t('auth.email')}
                  type="email"
                  placeholder={t('auth.emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
                <Button type="submit" loading={loading} className="w-full mt-4" size="lg">
                  {t('auth.forgot.sendResetLink')}
                </Button>
              </form>
            </>
          )}

          <Link
            href="/login"
            className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-700 hover:underline underline-offset-2"
          >
            <ArrowLeft size={14} strokeWidth={2} />
            {t('auth.backToSignIn')}
          </Link>
        </div>
      </div>
    </div>
  );
}
