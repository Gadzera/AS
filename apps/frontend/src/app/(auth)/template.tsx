'use client';

import { motion } from 'framer-motion';
import { LanguageSwitcher } from '@/i18n';

export default function AuthTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="min-h-screen"
    >
      {/* Переключатель языка доступен ДО входа (первый экран сервиса). */}
      <div className="absolute right-4 top-4 z-20">
        <LanguageSwitcher />
      </div>
      {children}
    </motion.div>
  );
}
