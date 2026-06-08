'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Zap } from 'lucide-react';
import { authApi } from '@/lib/api';
import { setToken, setStoredUser } from '@/lib/auth';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

const DEMO_PRIMARY = { email: 'demo@aisdr.dev', password: 'demo1234' };

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (creds: { email: string; password: string }) => {
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login(creds);
      setToken(res.token);
      setStoredUser(res.user);
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (err instanceof Error ? err.message : 'Login failed');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submit(form);
  };

  const fillDemo = () => {
    setForm(DEMO_PRIMARY);
    void submit(DEMO_PRIMARY);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-4 py-12">
      <div className="w-full max-w-[400px]">
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <span
            className="w-9 h-9 rounded-md flex items-center justify-center"
            style={{ backgroundColor: 'var(--text)' }}
          >
            <Zap className="text-white" size={16} strokeWidth={2.5} />
          </span>
          <span className="text-[16px] font-semibold text-[var(--text)]">
            AI SDR Agent
          </span>
        </div>

        <div
          className="bg-white border border-[var(--border)] rounded-xl p-6"
          style={{ boxShadow: 'var(--shadow-sm)' }}
        >
          <h1 className="text-[20px] font-semibold text-[var(--text)] mb-1 leading-7">
            Welcome back
          </h1>
          <p className="text-[13.5px] text-[var(--text-muted)] mb-6 leading-5">
            Sign in to continue to your workspace.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              label="Email"
              type="email"
              placeholder="you@company.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              autoComplete="email"
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              autoComplete="current-password"
            />

            {error && (
              <div
                className="text-[12.5px] px-3 py-2 rounded-md"
                style={{
                  backgroundColor: 'var(--danger-soft)',
                  color: 'var(--danger)',
                  border: '1px solid var(--danger-soft)',
                }}
              >
                {error}
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full mt-4" size="lg">
              Sign in
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <hr className="flex-1 border-[var(--border)]" />
            <span className="text-[12px] text-[var(--text-subtle)] font-medium">OR</span>
            <hr className="flex-1 border-[var(--border)]" />
          </div>

          <Button variant="secondary" className="w-full" size="lg" type="button">
            <Mail size={14} strokeWidth={1.75} className="text-[var(--text-muted)]" />
            Continue with Google
          </Button>

          <p className="text-[12.5px] text-center text-[var(--text-muted)] mt-6">
            Don&apos;t have an account?{' '}
            <Link
              href="/register"
              className="text-[var(--text)] font-medium hover:underline underline-offset-2"
            >
              Sign up
            </Link>
          </p>
        </div>

        <div
          className="mt-4 px-4 py-3 rounded-lg border border-[var(--border)] text-[12.5px]"
          style={{ backgroundColor: 'var(--surface-2)' }}
        >
          <p className="font-semibold text-[var(--text)] mb-1.5">Demo credentials</p>
          <p className="text-[var(--text-muted)] tabular-nums">demo@aisdr.dev · demo1234</p>
          <p className="text-[var(--text-muted)] tabular-nums">admin@aisdr.dev · admin1234</p>
          <button
            type="button"
            onClick={fillDemo}
            className="mt-1.5 text-[var(--brand)] font-medium hover:underline underline-offset-2"
          >
            Fill demo
          </button>
        </div>

        <p className="text-[12px] text-center text-[var(--text-subtle)] mt-6 leading-5">
          By signing in you agree to our Terms and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
