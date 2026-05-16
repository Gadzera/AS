'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  description?: string;
}

interface ToastContextValue {
  toast: (message: string, opts?: { type?: ToastType; description?: string }) => void;
  success: (message: string, description?: string) => void;
  error: (message: string, description?: string) => void;
  info: (message: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const icons: Record<ToastType, JSX.Element> = {
  success: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  warning: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  ),
  info: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

const styles: Record<ToastType, { wrap: string; icon: string; bar: string }> = {
  success: {
    wrap: 'border-green-500/20 bg-gray-900',
    icon: 'bg-green-500/10 text-green-400',
    bar:  'bg-green-500',
  },
  error: {
    wrap: 'border-red-500/20 bg-gray-900',
    icon: 'bg-red-500/10 text-red-400',
    bar:  'bg-red-500',
  },
  warning: {
    wrap: 'border-yellow-500/20 bg-gray-900',
    icon: 'bg-yellow-500/10 text-yellow-400',
    bar:  'bg-yellow-500',
  },
  info: {
    wrap: 'border-brand-500/20 bg-gray-900',
    icon: 'bg-brand-500/10 text-brand-400',
    bar:  'bg-brand-500',
  },
};

const DURATION = 4000;

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const s = styles[toast.type];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, x: 60 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={clsx(
        'relative flex items-start gap-3 w-80 p-3.5 rounded-xl border shadow-2xl overflow-hidden',
        s.wrap
      )}
    >
      {/* Progress bar */}
      <motion.div
        className={clsx('absolute bottom-0 left-0 h-0.5', s.bar)}
        initial={{ width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration: DURATION / 1000, ease: 'linear' }}
      />

      {/* Icon */}
      <div className={clsx('shrink-0 w-7 h-7 rounded-lg flex items-center justify-center', s.icon)}>
        {icons[toast.type]}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-sm font-medium text-white leading-snug">{toast.message}</p>
        {toast.description && (
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{toast.description}</p>
        )}
      </div>

      {/* Dismiss */}
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 p-1 text-gray-600 hover:text-gray-400 rounded transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </motion.div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
  }, []);

  const add = useCallback((message: string, opts: { type?: ToastType; description?: string } = {}) => {
    const id = Math.random().toString(36).slice(2);
    const type = opts.type ?? 'info';
    setToasts(prev => [...prev.slice(-4), { id, type, message, description: opts.description }]);
    const timer = setTimeout(() => dismiss(id), DURATION);
    timers.current.set(id, timer);
  }, [dismiss]);

  const ctx: ToastContextValue = {
    toast: add,
    success: (msg, desc) => add(msg, { type: 'success', description: desc }),
    error:   (msg, desc) => add(msg, { type: 'error',   description: desc }),
    info:    (msg, desc) => add(msg, { type: 'info',    description: desc }),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 items-end pointer-events-none">
        <div className="pointer-events-auto flex flex-col gap-2">
          <AnimatePresence mode="popLayout">
            {toasts.map(t => (
              <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
            ))}
          </AnimatePresence>
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
