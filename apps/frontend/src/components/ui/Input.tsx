'use client';

import { InputHTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={clsx(
            'block w-full rounded-lg bg-gray-900 border px-3 py-2 text-sm text-gray-100',
            'placeholder:text-gray-600 transition-all duration-150',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            error
              ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20'
              : 'border-gray-700 focus:border-brand-500/70 focus:ring-brand-500/20 hover:border-gray-600',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-400 flex items-center gap-1"><span>⚠</span>{error}</p>}
        {hint && !error && <p className="text-xs text-gray-600">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
