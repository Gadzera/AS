'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Zap } from 'lucide-react';
import { authApi } from '@/lib/api';
import { setToken, setStoredUser } from '@/lib/auth';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', orgName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.register(form);
      setToken(res.token);
      setStoredUser(res.user);
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (err instanceof Error ? err.message : 'Registration failed');
      setError(msg);
    } finally {
      setLoading(false);
    }
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
            Create your account
          </h1>
          <p className="text-[13.5px] text-[var(--text-muted)] mb-6 leading-5">
            Free forever on the starter plan. No credit card required.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              label="Your name"
              placeholder="Jane Smith"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              autoComplete="name"
            />
            <Input
              label="Company"
              placeholder="Acme Inc."
              value={form.orgName}
              onChange={(e) => setForm({ ...form, orgName: e.target.value })}
              required
            />
            <Input
              label="Work email"
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
              placeholder="Min. 8 characters"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={8}
              autoComplete="new-password"
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
              Create account
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
            Already have an account?{' '}
            <Link
              href="/login"
              className="text-[var(--text)] font-medium hover:underline underline-offset-2"
            >
              Sign in
            </Link>
          </p>
        </div>

        <p className="text-[12px] text-center text-[var(--text-subtle)] mt-6 leading-5">
          By signing up you agree to our Terms and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
