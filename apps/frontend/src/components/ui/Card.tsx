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

  const cls = clsx(
    'bg-surface rounded-xl border border-line shadow-sm',
    paddings[padding],
    className
  );

  if (hover) {
    return (
      <motion.div
        whileHover={{ y: -2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={clsx(cls, 'transition-shadow hover:shadow-md hover:border-line-strong')}
      >
        {children}
      </motion.div>
    );
  }

  return <div className={cls}>{children}</div>;
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('mb-4 flex items-center justify-between', className)}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={clsx('text-sm font-semibold text-ink', className)}>{children}</h3>;
}
