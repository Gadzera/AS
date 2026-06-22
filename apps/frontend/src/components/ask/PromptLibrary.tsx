'use client';

/* ──────────────────────────────────────────────────────────────────────────
   PromptLibrary (M26-2, S187/S188) — библиотека сохранённых промптов Ask AISDR.
   PERSONAL — личные (default); WORKSPACE — общие для воркспейса (создавать/править/
   удалять может только OWNER/ADMIN; переиспользовать — все). Вставка промпта в
   композер через onInsert. Bold-тема.
   ────────────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useState } from 'react';
import { askApi, type SavedPrompt } from '@/lib/api';
import { BookMarked, Plus, Pencil, Trash2, X, Users, User, Loader2, CornerDownLeft } from 'lucide-react';

type Draft = { id?: string; title: string; body: string; scope: 'PERSONAL' | 'WORKSPACE' };
const EMPTY: Draft = { title: '', body: '', scope: 'PERSONAL' };

export default function PromptLibrary({
  open,
  onClose,
  onInsert,
  seedBody,
  canManageWorkspace,
}: {
  open: boolean;
  onClose: () => void;
  /** вставить тело промпта в композер ассистента */
  onInsert: (body: string) => void;
  /** предзаполнить «сохранить как промпт» текущим вводом */
  seedBody?: string;
  /** OWNER/ADMIN — может управлять WORKSPACE-промптами */
  canManageWorkspace: boolean;
}) {
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    askApi.prompts().then(setPrompts).catch(() => setErr('Could not load prompts')).finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (open) { reload(); setEditing(null); setErr(null); } }, [open, reload]);

  const startNew = () => setEditing({ ...EMPTY, body: seedBody?.trim() ? seedBody.trim() : '' });
  const startEdit = (p: SavedPrompt) => setEditing({ id: p.id, title: p.title, body: p.body, scope: p.scope });

  const save = useCallback(async () => {
    if (!editing) return;
    const title = editing.title.trim();
    const body = editing.body.trim();
    if (!title || !body) { setErr('Title and prompt text are required'); return; }
    setSaving(true);
    setErr(null);
    try {
      if (editing.id) await askApi.updatePrompt(editing.id, { title, body });
      else await askApi.createPrompt({ title, body, scope: editing.scope });
      setEditing(null);
      reload();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setErr(msg ?? 'Could not save prompt');
    } finally {
      setSaving(false);
    }
  }, [editing, reload]);

  const remove = useCallback(async (p: SavedPrompt) => {
    if (!p.canEdit) return;
    setPrompts((list) => list.filter((x) => x.id !== p.id)); // optimistic
    try { await askApi.deletePrompt(p.id); } catch { reload(); }
  }, [reload]);

  if (!open) return null;

  const personal = prompts.filter((p) => p.scope === 'PERSONAL');
  const workspace = prompts.filter((p) => p.scope === 'WORKSPACE');

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="brand-gradient flex h-7 w-7 items-center justify-center rounded-lg text-white"><BookMarked size={15} /></span>
            <h3 className="text-[14px] font-extrabold tracking-[-0.01em] text-ink">Prompt library</h3>
          </div>
          <div className="flex items-center gap-2">
            {!editing && (
              <button type="button" onClick={startNew} className="brand-gradient inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-white shadow-brand transition-all hover:-translate-y-0.5"><Plus size={13} /> New</button>
            )}
            <button type="button" onClick={onClose} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-ink-subtle hover:bg-surface-2 hover:text-ink"><X size={16} /></button>
          </div>
        </div>

        {editing ? (
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.05em] text-ink-muted">Title</label>
              <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="e.g. Daily prep" maxLength={120}
                className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-[13px] text-ink outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.05em] text-ink-muted">Prompt</label>
              <textarea value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} rows={5} maxLength={4000} placeholder="Help me prep for my day — summarise my hot leads and what to do next."
                className="w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100" />
            </div>
            {!editing.id && (
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.05em] text-ink-muted">Visibility</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditing({ ...editing, scope: 'PERSONAL' })} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium ${editing.scope === 'PERSONAL' ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-line text-ink-muted hover:bg-surface-2'}`}><User size={13} /> Personal</button>
                  <button type="button" disabled={!canManageWorkspace} onClick={() => setEditing({ ...editing, scope: 'WORKSPACE' })} title={canManageWorkspace ? '' : 'Only workspace admins can create workspace prompts'}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium ${editing.scope === 'WORKSPACE' ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-line text-ink-muted hover:bg-surface-2'} ${!canManageWorkspace ? 'cursor-not-allowed opacity-50' : ''}`}><Users size={13} /> Workspace</button>
                </div>
                {!canManageWorkspace && <p className="mt-1 text-[10.5px] text-ink-subtle">Workspace prompts are managed by workspace admins.</p>}
              </div>
            )}
            {err && <p className="text-[12px] font-semibold text-rose-600">{err}</p>}
            <div className="flex items-center gap-2 pt-1">
              <button type="button" disabled={saving} onClick={() => void save()} className="brand-gradient inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-brand transition-all hover:-translate-y-0.5 disabled:opacity-60">
                {saving ? <Loader2 size={14} className="animate-spin" /> : null} {editing.id ? 'Save changes' : 'Save prompt'}
              </button>
              <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-line px-3 py-2 text-[12.5px] font-medium text-ink-muted hover:bg-surface-2">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-[12.5px] text-ink-muted"><Loader2 size={15} className="animate-spin text-brand-500" /> Loading prompts…</div>
            ) : prompts.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-surface-2 text-ink-subtle"><BookMarked size={20} /></span>
                <p className="text-[13px] font-bold text-ink">No saved prompts yet</p>
                <p className="mt-1 max-w-xs text-[12px] text-ink-muted">Save prompts you use often — like a daily-prep or objection-handling question — and reuse them in one click.</p>
                <button type="button" onClick={startNew} className="brand-gradient mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white shadow-brand"><Plus size={13} /> New prompt</button>
              </div>
            ) : (
              <div className="space-y-4">
                {[{ key: 'PERSONAL', label: 'Personal', icon: <User size={12} />, items: personal }, { key: 'WORKSPACE', label: 'Workspace', icon: <Users size={12} />, items: workspace }].map((group) => group.items.length > 0 && (
                  <div key={group.key}>
                    <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.05em] text-ink-muted">{group.icon} {group.label}</p>
                    <div className="space-y-1.5">
                      {group.items.map((p) => (
                        <div key={p.id} className="group flex items-start gap-2 rounded-xl border border-line bg-surface p-2.5 transition-colors hover:border-brand-200 hover:bg-brand-50/40">
                          <button type="button" onClick={() => { onInsert(p.body); onClose(); }} className="min-w-0 flex-1 text-left">
                            <p className="truncate text-[12.5px] font-bold text-ink">{p.title}</p>
                            <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-4 text-ink-muted">{p.body}</p>
                            <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-brand-600"><CornerDownLeft size={10} /> Insert into chat</span>
                          </button>
                          {p.canEdit && (
                            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                              <button type="button" onClick={() => startEdit(p)} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-2 hover:text-ink" title="Edit"><Pencil size={13} /></button>
                              <button type="button" onClick={() => void remove(p)} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-subtle hover:bg-rose-50 hover:text-rose-600" title="Delete"><Trash2 size={13} /></button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
