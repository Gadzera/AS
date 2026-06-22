'use client';

/* CreateRecordModal — создание записи в текущем объекте (M0). Поля строятся из
   реальных атрибутов объекта; на сохранении вызывает createRecord. */

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Loader2 } from 'lucide-react';
import { createRecord, type CrmAttribute, type CrmRecordValue } from '@/lib/crmApi';

const EDITABLE = new Set(['TEXT', 'LONG_TEXT', 'NUMBER', 'CURRENCY', 'EMAIL', 'PHONE', 'URL']);

export default function CreateRecordModal({
  objectKey,
  objectLabel,
  attrs,
  onClose,
  onCreated,
}: {
  objectKey: string;
  objectLabel: string;
  attrs: CrmAttribute[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const fields = useMemo(() => {
    const editable = attrs.filter((a) => EDITABLE.has(a.type) && !a.aiEnabled);
    // primary/name первым
    return editable.sort((a, b) => (a.key === 'name' ? -1 : b.key === 'name' ? 1 : a.order - b.order)).slice(0, 8);
  }, [attrs]);

  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const nameKey = fields.find((f) => f.key === 'name')?.key ?? fields[0]?.key;
  const canSave = !!(nameKey && (draft[nameKey] ?? '').trim());

  async function save() {
    if (!canSave) { setErr('Заполните название'); return; }
    setSaving(true); setErr('');
    const values: Record<string, CrmRecordValue> = {};
    for (const f of fields) {
      const v = (draft[f.key] ?? '').trim();
      if (v === '') continue;
      values[f.key] = f.type === 'NUMBER' || f.type === 'CURRENCY' ? Number(v) : v;
    }
    try {
      await createRecord(objectKey, values);
      onCreated();
      onClose();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setErr(msg ?? 'Не удалось создать запись');
      setSaving(false);
    }
  }

  return (
    <>
      <motion.div className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <motion.div
          className="w-full max-w-md rounded-2xl border border-line bg-surface shadow-2xl"
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="text-[15px] font-bold text-ink">New {objectLabel.toLowerCase()}</h2>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-ink-subtle hover:bg-surface-2 hover:text-ink"><X size={17} /></button>
          </div>
          <div className="max-h-[60vh] space-y-3 overflow-y-auto px-5 py-4">
            {fields.map((f) => (
              <div key={f.id}>
                <label className="mb-1 block text-[11.5px] font-semibold text-ink-muted">{f.name}{f.key === nameKey && <span className="text-rose-500"> *</span>}</label>
                <input
                  value={draft[f.key] ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                  placeholder={f.type === 'URL' ? 'https://…' : ''}
                  inputMode={f.type === 'NUMBER' || f.type === 'CURRENCY' ? 'numeric' : 'text'}
                  className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-[13px] text-ink outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                />
              </div>
            ))}
            {err && <p className="text-[12px] font-medium text-rose-600">{err}</p>}
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
            <button type="button" onClick={onClose} className="h-9 rounded-lg px-3 text-[13px] font-medium text-ink-muted hover:text-ink">Cancel</button>
            <button
              type="button"
              disabled={!canSave || saving}
              onClick={save}
              className="brand-gradient inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-[13px] font-semibold text-white shadow-brand disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create
            </button>
          </div>
        </motion.div>
      </div>
    </>
  );
}
