'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ShieldCheck, CheckCircle2, Zap } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { authApi } from '@/lib/api';

/* /reset-password?token=… — установка нового пароля по токену сброса (JWT, 30 мин).
   Backend POST /api/auth/reset-password проверяет токен и обновляет passwordHash. */

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const t = new URLSearchParams(window.location.search).get('token');
    setToken(t);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (!token) { setError('Reset link is invalid'); return; }
    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
      setTimeout(() => router.push('/login'), 2200);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (err instanceof Error ? err.message : 'Could not reset password');
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
          {done ? (
            <div className="text-center">
              <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                <CheckCircle2 size={26} strokeWidth={2} />
              </span>
              <h1 className="text-[24px] font-extrabold tracking-[-0.02em] text-ink mb-1.5">Password updated</h1>
              <p className="text-[14px] text-ink-muted leading-5">Your password has been changed. Redirecting to sign in…</p>
              <Link href="/login" className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-700 hover:underline underline-offset-2">
                Go to sign in →
              </Link>
            </div>
          ) : token === null ? (
            <div className="text-center">
              <h1 className="text-[24px] font-extrabold tracking-[-0.02em] text-ink mb-1.5">Invalid reset link</h1>
              <p className="text-[14px] text-ink-muted leading-5">This link is missing its token. Request a new password reset.</p>
              <Link href="/forgot-password" className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-700 hover:underline underline-offset-2">
                <ArrowLeft size={14} strokeWidth={2} /> Request reset link
              </Link>
            </div>
          ) : (
            <>
              <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-600">
                <ShieldCheck size={22} strokeWidth={2} />
              </span>
              <h1 className="text-[30px] font-extrabold tracking-[-0.025em] text-ink mb-1.5 leading-[1.08]">Set a new password</h1>
              <p className="text-[15px] text-ink-muted mb-7 leading-5">Choose a strong password for your account.</p>

              <form onSubmit={handleSubmit} className="space-y-3">
                {error && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[12.5px] font-medium text-rose-700">{error}</div>
                )}
                <Input label="New password" type="password" placeholder="Min. 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
                <Input label="Confirm password" type="password" placeholder="Repeat password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" />
                <Button type="submit" loading={loading} className="w-full mt-4" size="lg">Update password</Button>
              </form>
            </>
          )}

          <Link href="/login" className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-700 hover:underline underline-offset-2">
            <ArrowLeft size={14} strokeWidth={2} /> Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
