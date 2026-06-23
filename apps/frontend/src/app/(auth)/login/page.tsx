'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Zap } from 'lucide-react';
import { authApi } from '@/lib/api';
import { setToken, setStoredUser } from '@/lib/auth';
import { useT } from '@/i18n';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

const DEMO_PRIMARY = { email: 'demo@aisdr.dev', password: 'demo1234' };

// Брендовая Google «G» (4 цвета) для кнопки соц-входа.
function GoogleG() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden className="shrink-0">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const t = useT();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // M23-1: 2-step при включённом 2FA
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState('');

  const submit = async (creds: { email: string; password: string }) => {
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login(creds);
      if ('requiresTwoFactor' in res) { setChallenge(res.challenge); setLoading(false); return; } // ждём код
      setToken(res.token);
      setStoredUser(res.user);
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (err instanceof Error ? err.message : t('auth.errors.loginFailed'));
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const verifyTwoFactor = async () => {
    if (!challenge || !code.trim()) return;
    setError(''); setLoading(true);
    try {
      const res = await authApi.verifyLogin(challenge, code.trim());
      setToken(res.token); setStoredUser(res.user); router.push('/dashboard');
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? t('auth.errors.invalidCode'));
    } finally { setLoading(false); }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (challenge) void verifyTwoFactor();
    else void submit(form);
  };

  const fillDemo = () => {
    setForm(DEMO_PRIMARY);
    void submit(DEMO_PRIMARY);
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
          <h1 className="text-[30px] font-extrabold tracking-[-0.025em] text-ink mb-1.5 leading-[1.08]">
            {t('auth.login.title')}
          </h1>
          <p className="text-[15px] text-ink-muted mb-7 leading-5">
            {t('auth.login.subtitle')}
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[12.5px] font-medium text-rose-700">
                {error}
              </div>
            )}
            {challenge ? (
              /* M23-1: второй шаг — код 2FA (TOTP или recovery) */
              <>
                <div className="rounded-xl border border-brand-200 bg-brand-50/60 px-3 py-2.5 text-[12.5px] text-brand-900">{t('auth.login.twoFactorPrompt')}</div>
                <Input
                  label={t('auth.login.authCode')}
                  type="text"
                  placeholder={t('auth.login.authCodePlaceholder')}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoFocus
                  autoComplete="one-time-code"
                />
                <Button type="submit" loading={loading} className="w-full mt-2" size="lg">{t('auth.login.verifySignIn')}</Button>
                <button type="button" onClick={() => { setChallenge(null); setCode(''); setError(''); }} className="w-full text-center text-[12px] font-medium text-ink-muted hover:text-ink">{t('auth.login.back')}</button>
              </>
            ) : (
              <>
                <Input
                  label={t('auth.email')}
                  type="email"
                  placeholder={t('auth.emailPlaceholder')}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  autoComplete="email"
                />
                <Input
                  label={t('auth.password')}
                  type="password"
                  placeholder={t('auth.login.passwordPlaceholder')}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  autoComplete="current-password"
                />

                <div className="flex justify-end -mt-1">
                  <Link href="/forgot-password" className="text-[12.5px] font-medium text-brand-700 hover:underline underline-offset-2">
                    {t('auth.login.forgot')}
                  </Link>
                </div>

                <Button type="submit" loading={loading} className="w-full mt-4" size="lg">
                  {t('auth.signIn')}
                </Button>
              </>
            )}
          </form>

          <div className="my-5 flex items-center gap-3">
            <hr className="flex-1 border-[var(--border)]" />
            <span className="text-[12px] text-[var(--text-subtle)] font-medium">{t('auth.or')}</span>
            <hr className="flex-1 border-[var(--border)]" />
          </div>

          <Button
            variant="secondary"
            className="w-full cursor-not-allowed opacity-70"
            size="lg"
            type="button"
            disabled
            title={t('auth.googleOauthSoon')}
          >
            <GoogleG />
            {t('auth.continueGoogle')}
            <span className="ml-1.5 rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-subtle">
              {t('auth.soon')}
            </span>
          </Button>
          <p className="mt-1.5 text-center text-[11.5px] text-ink-subtle">
            {t('auth.login.googleSigninSoon')}
          </p>

          <p className="text-[12.5px] text-center text-[var(--text-muted)] mt-6">
            {t('auth.login.noAccount')}{' '}
            <Link
              href="/register"
              className="text-[var(--text)] font-medium hover:underline underline-offset-2"
            >
              {t('auth.signUp')}
            </Link>
          </p>
        </div>

        <div className="mt-4 px-4 py-3.5 rounded-2xl border border-brand-200/60 bg-[linear-gradient(135deg,rgba(79,70,229,0.08),rgba(217,70,239,0.08))] text-[12.5px]">
          <p className="font-bold text-ink mb-1.5">{t('auth.login.demoTitle')}</p>
          <p className="text-ink-muted tabular-nums">demo@aisdr.dev · demo1234</p>
          <p className="text-ink-muted tabular-nums">admin@aisdr.dev · admin1234</p>
          <button
            type="button"
            onClick={fillDemo}
            className="mt-2 inline-flex h-7 items-center rounded-lg bg-white/70 px-2.5 font-semibold text-brand-700 ring-1 ring-brand-200/70 transition-colors hover:bg-white hover:text-brand-800"
          >
            {t('auth.login.enterDemo')}
          </button>
        </div>

        <p className="text-[12px] text-center text-[var(--text-subtle)] mt-6 leading-5">
          {t('auth.login.agreePrefix')}{' '}
          <Link href="/terms" className="font-medium text-brand-700 hover:underline underline-offset-2">{t('auth.terms')}</Link>{' '}
          {t('auth.and')}{' '}
          <Link href="/privacy" className="font-medium text-brand-700 hover:underline underline-offset-2">{t('auth.privacy')}</Link>.
        </p>
      </div>
    </div>
  );
}
