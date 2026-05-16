'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { authApi } from '@/lib/api';
import { setToken, setStoredUser } from '@/lib/auth';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

const steps = [
  { icon: '🚀', label: 'Set up in 2 minutes' },
  { icon: '🆓', label: 'Free plan, no credit card' },
  { icon: '🤖', label: 'AI writes your first email' },
];

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '', name: '', orgName: '' });
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
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Registration failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#080b10]">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[480px] shrink-0 relative overflow-hidden px-12 py-14 bg-gradient-to-br from-[#0d0f1a] to-[#080b10] border-r border-gray-800/60">
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.25, 0.15] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-[-80px] left-[-80px] w-80 h-80 rounded-full bg-purple-600 blur-[120px] pointer-events-none"
        />
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
          className="absolute bottom-0 right-[-40px] w-72 h-72 rounded-full bg-brand-500 blur-[100px] pointer-events-none"
        />

        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-purple-600 rounded-xl flex items-center justify-center shadow-glow-sm">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="text-white font-bold text-lg tracking-tight">AI SDR Agent</span>
        </div>

        <div className="relative space-y-8">
          <div>
            <h2 className="text-3xl font-bold text-white leading-tight">
              Start closing deals<br />
              <span className="text-gradient">on autopilot.</span>
            </h2>
            <p className="text-gray-400 mt-3 text-sm leading-relaxed">
              Join 500+ B2B teams that replaced expensive SDRs with AI that never sleeps, never misses a follow-up.
            </p>
          </div>

          <div className="space-y-4">
            {steps.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.1, duration: 0.3 }}
                className="flex items-center gap-3 p-3.5 rounded-xl bg-gray-800/30 border border-gray-700/30"
              >
                <span className="text-xl">{s.icon}</span>
                <span className="text-sm font-medium text-gray-300">{s.label}</span>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="relative">
          <blockquote className="text-sm text-gray-500 italic leading-relaxed border-l-2 border-brand-500/40 pl-4">
            &ldquo;Booked 12 demos in the first week. The AI personalization is insane — prospects actually think we wrote each email manually.&rdquo;
          </blockquote>
          <p className="text-xs text-gray-600 mt-2 pl-4">— Marcus T., VP Sales at Techflow</p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-sm"
        >
          <div className="flex lg:hidden items-center gap-3 mb-8">
            <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-purple-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-white font-bold text-base">AI SDR Agent</span>
          </div>

          <div className="mb-7">
            <h1 className="text-2xl font-bold text-white">Create your account</h1>
            <p className="text-gray-500 text-sm mt-1">Free forever on the starter plan</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Your name"
                placeholder="Jane Smith"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <Input
                label="Company"
                placeholder="Acme Inc."
                value={form.orgName}
                onChange={(e) => setForm({ ...form, orgName: e.target.value })}
                required
              />
            </div>
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
            />

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
              Create free account
            </Button>
          </form>

          <p className="text-center text-[11px] text-gray-700 mt-4 leading-relaxed">
            By signing up you agree to our{' '}
            <span className="text-gray-600 hover:text-gray-400 cursor-pointer transition-colors">Terms</span>
            {' & '}
            <span className="text-gray-600 hover:text-gray-400 cursor-pointer transition-colors">Privacy Policy</span>
          </p>

          <p className="text-center text-sm text-gray-600 mt-3">
            Already have an account?{' '}
            <Link href="/login" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
