'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { authApi } from '@/lib/api';
import { setToken, setStoredUser } from '@/lib/auth';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

const features = [
  { icon: '⚡', text: 'AI writes hyper-personalized cold emails in seconds' },
  { icon: '🔥', text: 'Warm-up protection keeps your domain reputation safe' },
  { icon: '🎯', text: 'Smart sequences follow up until leads reply' },
  { icon: '📊', text: 'Real-time analytics — opens, clicks, replies' },
];

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login(form);
      setToken(res.token);
      setStoredUser(res.user);
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Login failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#080b10]">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-[480px] shrink-0 relative overflow-hidden px-12 py-14 bg-gradient-to-br from-[#0d0f1a] to-[#080b10] border-r border-gray-800/60">
        {/* Animated blobs */}
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.25, 0.15] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-[-80px] left-[-80px] w-80 h-80 rounded-full bg-brand-500 blur-[120px] pointer-events-none"
        />
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          className="absolute bottom-[-60px] right-[-60px] w-72 h-72 rounded-full bg-purple-600 blur-[100px] pointer-events-none"
        />

        {/* Logo */}
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-purple-600 rounded-xl flex items-center justify-center shadow-glow-sm">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-white font-bold text-lg tracking-tight">AI SDR Agent</span>
          </div>
        </div>

        {/* Hero text */}
        <div className="relative space-y-6">
          <div>
            <h2 className="text-3xl font-bold text-white leading-tight">
              Your AI sales team,<br />
              <span className="text-gradient">always on.</span>
            </h2>
            <p className="text-gray-400 mt-3 text-sm leading-relaxed">
              Automate cold outreach, personalize at scale, and book more meetings — without hiring more SDRs.
            </p>
          </div>

          <div className="space-y-3">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.08, duration: 0.3 }}
                className="flex items-center gap-3"
              >
                <span className="text-base">{f.icon}</span>
                <span className="text-sm text-gray-400">{f.text}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Social proof */}
        <div className="relative flex items-center gap-2 text-xs text-gray-600">
          <div className="flex -space-x-2">
            {['E', 'M', 'A', 'K'].map((l, i) => (
              <div key={i} className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-500/60 to-purple-600/60 border border-[#080b10] flex items-center justify-center text-[9px] text-white font-bold">
                {l}
              </div>
            ))}
          </div>
          <span>500+ teams automating their sales pipeline</span>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-sm"
        >
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-8">
            <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-purple-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-white font-bold text-base">AI SDR Agent</span>
          </div>

          <div className="mb-7">
            <h1 className="text-2xl font-bold text-white">Welcome back</h1>
            <p className="text-gray-500 text-sm mt-1">Sign in to your account to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="you@company.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              autoComplete="email"
            />
            <div>
              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                autoComplete="current-password"
              />
              <div className="mt-1.5 flex justify-end">
                <span className="text-xs text-gray-600 hover:text-brand-400 cursor-pointer transition-colors">
                  Forgot password?
                </span>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg px-3 py-2.5"
              >
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                {error}
              </motion.div>
            )}

            <Button type="submit" loading={loading} className="w-full mt-1" size="lg">
              Sign in
            </Button>
          </form>

          <p className="text-center text-sm text-gray-600 mt-5">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
              Create one free
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
