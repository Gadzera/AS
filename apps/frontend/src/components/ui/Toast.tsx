'use client';

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, AlertCircle, Info, X } from 'lucide-react';
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
  warning: (message: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DURATION = 4000;

function getIcon(type: ToastType) {
  switch (type) {
    case 'success':
      return <Check size={14} strokeWidth={2} style={{ color: 'var(--success)' }} />;
    case 'error':
      return <AlertCircle size={14} strokeWidth={2} style={{ color: 'var(--danger)' }} />;
    case 'warning':
      return <AlertCircle size={14} strokeWidth={2} style={{ color: 'var(--warning)' }} />;
    case 'info':
    default:
      return <Info size={14} strokeWidth={2} style={{ color: 'var(--info)' }} />;
  }
}

function ToastItem({
  toast,
  onDismiss,
  onPause,
  onResume,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      onMouseEnter={() => onPause(toast.id)}
      onMouseLeave={() => onResume(toast.id)}
      className={clsx(
        'bg-white border border-[var(--border)] rounded-lg pl-3 pr-2 h-10',
        'flex items-center gap-2.5 min-w-[280px] max-w-[400px]',
      )}
      style={{ boxShadow: 'var(--shadow-popover)' }}
      role="status"
    >
      <span className="shrink-0 inline-flex items-center">{getIcon(toast.type)}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-[var(--text)] truncate leading-none">
          {toast.message}
        </p>
        {toast.description && (
          <p className="text-[12px] text-[var(--text-muted)] truncate mt-0.5 leading-none">
            {toast.description}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss"
        className="shrink-0 w-5 h-5 rounded inline-flex items-center justify-center text-[var(--text-subtle)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors duration-100"
      >
        <X size={12} strokeWidth={1.75} />
      </button>
    </motion.div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const clearTimer = (id: string) => {
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
  };

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimer(id);
  }, []);

  const scheduleDismiss = (id: string) => {
    clearTimer(id);
    const timer = setTimeout(() => dismiss(id), DURATION);
    timers.current.set(id, timer);
  };

  const pause = useCallback((id: string) => {
    clearTimer(id);
  }, []);

  const resume = useCallback((id: string) => {
    scheduleDismiss(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = useCallback(
    (
      message: string,
      opts: { type?: ToastType; description?: string } = {},
    ) => {
      const id = Math.random().toString(36).slice(2);
      const type = opts.type ?? 'info';
      setToasts((prev) => [...prev.slice(-4), { id, type, message, description: opts.description }]);
      scheduleDismiss(id);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [dismiss],
  );

  const ctx: ToastContextValue = {
    toast: add,
    success: (msg, desc) => add(msg, { type: 'success', description: desc }),
    error:   (msg, desc) => add(msg, { type: 'error',   description: desc }),
    info:    (msg, desc) => add(msg, { type: 'info',    description: desc }),
    warning: (msg, desc) => add(msg, { type: 'warning', description: desc }),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 items-end pointer-events-none max-w-[400px]">
        <div className="pointer-events-auto flex flex-col gap-2">
          <AnimatePresence mode="popLayout">
            {toasts.map((t) => (
              <ToastItem
                key={t.id}
                toast={t}
                onDismiss={dismiss}
                onPause={pause}
                onResume={resume}
              />
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
