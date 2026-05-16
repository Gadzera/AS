'use client';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import TagBadge from './TagBadge';

interface Tag { id: string; name: string; color: string; }

interface TagManagerProps {
  leadId: string;
  currentTags: Tag[];
  onUpdate: () => void;
}

const COLOR_PRESETS = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4'];

export default function TagManager({ leadId, currentTags, onUpdate }: TagManagerProps) {
  const [open, setOpen] = useState(false);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(COLOR_PRESETS[0]);
  const [creating, setCreating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) api.get<Tag[]>('/tags').then(r => setAllTags(r.data));
  }, [open]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const currentTagIds = new Set(currentTags.map(t => t.id));

  const addTag = async (tagId: string) => {
    await api.post(`/tags/${tagId}/leads/${leadId}`);
    onUpdate();
  };

  const removeTag = async (tagId: string) => {
    await api.delete(`/tags/${tagId}/leads/${leadId}`);
    onUpdate();
  };

  const createAndAdd = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await api.post<Tag>('/tags', { name: newName.trim(), color: newColor });
      await api.post(`/tags/${res.data.id}/leads/${leadId}`);
      setNewName('');
      onUpdate();
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 relative" ref={dropdownRef}>
      {currentTags.map(tag => (
        <TagBadge key={tag.id} name={tag.name} color={tag.color} onRemove={() => removeTag(tag.id)} />
      ))}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-5 h-5 rounded-full border border-dashed border-gray-600 text-gray-500 hover:border-brand-500 hover:text-brand-400 transition-colors flex items-center justify-center text-xs"
        aria-label="Add tag"
      >+</button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full left-0 mt-1.5 w-56 bg-gray-900 border border-gray-700/60 rounded-xl shadow-2xl z-50 p-2"
          >
            <div className="space-y-1 max-h-40 overflow-y-auto mb-2">
              {allTags.filter(t => !currentTagIds.has(t.id)).map(tag => (
                <button
                  key={tag.id}
                  onClick={() => { addTag(tag.id); setOpen(false); }}
                  className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-gray-800 flex items-center gap-2 text-sm"
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                  <span className="text-gray-300">{tag.name}</span>
                </button>
              ))}
              {allTags.filter(t => !currentTagIds.has(t.id)).length === 0 && (
                <p className="text-xs text-gray-600 px-2 py-1">No more tags</p>
              )}
            </div>
            <div className="border-t border-gray-800 pt-2">
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createAndAdd()}
                placeholder="New tag name..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-gray-200 placeholder-gray-600 mb-1.5 focus:outline-none focus:border-brand-500"
              />
              <div className="flex gap-1 flex-wrap mb-1.5">
                {COLOR_PRESETS.map(c => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className={`w-4 h-4 rounded-full transition-transform ${newColor === c ? 'scale-125 ring-2 ring-white/40' : ''}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <button
                onClick={createAndAdd}
                disabled={!newName.trim() || creating}
                className="w-full py-1 text-xs font-medium bg-brand-500/20 text-brand-400 border border-brand-500/30 rounded-lg hover:bg-brand-500/30 transition-colors disabled:opacity-40"
              >
                {creating ? 'Creating...' : 'Create & Add'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
