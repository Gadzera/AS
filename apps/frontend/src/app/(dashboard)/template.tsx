'use client';

import { motion } from 'framer-motion';
import { usePathname } from 'next/navigation';

export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="flex-1 flex flex-col min-w-0"
    >
      {children}
    </motion.div>
  );
}
