'use client';

import { Users, Upload, Search, Plus } from 'lucide-react';
import Button from '@/components/ui/Button';

interface EmptyLeadsStateProps {
  onAdd: () => void;
  onImport: () => void;
  onApollo?: () => void;
}

export default function EmptyLeadsState({ onAdd, onImport, onApollo }: EmptyLeadsStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-24 px-6">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
        style={{ backgroundColor: 'var(--surface-2)' }}
      >
        <Users size={24} strokeWidth={1.75} className="text-[var(--text-subtle)]" />
      </div>
      <h2 className="text-[16px] font-semibold text-[var(--text)] leading-6">
        No leads yet
      </h2>
      <p className="mt-1 text-[13.5px] text-[var(--text-muted)] max-w-[320px] leading-5">
        Add your first lead manually, import from CSV, or run an Apollo search.
      </p>
      <div className="flex items-center gap-2 mt-5">
        <Button size="sm" onClick={onAdd}>
          <Plus size={14} strokeWidth={1.75} />
          New Lead
        </Button>
        <Button size="sm" variant="secondary" onClick={onImport}>
          <Upload size={14} strokeWidth={1.75} />
          Import CSV
        </Button>
        {onApollo && (
          <Button size="sm" variant="secondary" onClick={onApollo}>
            <Search size={14} strokeWidth={1.75} />
            Apollo search
          </Button>
        )}
      </div>
    </div>
  );
}
