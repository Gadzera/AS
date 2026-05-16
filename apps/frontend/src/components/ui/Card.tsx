'use client';

import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
}

export default function Card({ children, className, padding = 'md', hover = false }: CardProps) {
  const paddings = { none: '', sm: 'p-4', md: 'p-5', lg: 'p-6' };

  if (hover) {
    return (
      <motion.div
        whileHover={{ y: -2, borderColor: 'rgba(99,102,241,0.3)' }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className={clsx(
          'bg-gray-900 rounded-xl border border-gray-800 shadow-card transition-shadow hover:shadow-glow-sm',
          paddings[padding],
          className
        )}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div
      className={clsx(
        'bg-gray-900 rounded-xl border border-gray-800 shadow-card',
        paddings[padding],
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('mb-4 flex items-center justify-between', className)}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h3 className={clsx('text-sm font-semibold text-white', className)}>{children}</h3>
  );
}
