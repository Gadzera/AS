'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import { AlertCircle } from 'lucide-react';
import clsx from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, className, id, ...props },
  ref,
) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={inputId}
          className="text-[12px] font-medium text-[var(--text-muted)] leading-4"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        ref={ref}
        className={clsx(
          'block w-full h-10 px-3 rounded-lg bg-[var(--surface)] text-[14px] text-[var(--text)]',
          'border border-[var(--border-strong)]',
          'placeholder:text-[var(--text-subtle)]',
          'transition-colors duration-100',
          'focus:outline-none focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand-soft)]',
          error && 'border-[var(--danger)] focus:border-[var(--danger)] focus:ring-[var(--danger-soft)]',
          className,
        )}
        {...props}
      />
      {error && (
        <p className="text-[12px] text-[var(--danger)] inline-flex items-center gap-1 leading-4">
          <AlertCircle size={12} strokeWidth={1.75} />
          <span>{error}</span>
        </p>
      )}
      {hint && !error && (
        <p className="text-[12px] text-[var(--text-subtle)] leading-4">{hint}</p>
      )}
    </div>
  );
});

export default Input;
