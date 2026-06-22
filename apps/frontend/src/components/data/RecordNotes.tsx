'use client';

/**
 * RecordNotes (M27-2) — заметки записи. Простой текст (без @mentions). Soft-delete: удалённая показывается
 * плейсхолдером. Правка/удаление — автор или OWNER/ADMIN (бэкенд enforce; UI прячет кнопки у чужих).
 */
import { useCallback, useEffect, useState } from 'react';
import { Loader2, Trash2, Pencil, StickyNote, Check, X } from 'lucide-react';
import { listNotes, createNote, updateNote, deleteNote, type CrmNote } from '@/lib/crmApi';
import { getStoredUser } from '@/lib/auth';

function errMsg(e: unknown): string {
  return (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Something went wrong';
}
function timeAgo(iso: string): string {
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d);
}

export default function RecordNotes({ recordId, onCount }: { recordId: string; onCount?: (n: number) => void }) {
  const [notes, setNotes] = useState<CrmNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const [err, setErr] = useState('');
  const me = getStoredUser();
  const isManager = me?.role === 'OWNER' || me?.role === 'ADMIN';
  const canEdit = (n: CrmNote) => !n.deleted && (isManager || n.author?.id === me?.id);

  const load = useCallback(async () => {
    setLoading(true);
    try { const n = await listNotes(recordId); setNotes(n); onCount?.(n.filter((x) => !x.deleted).length); }
    catch { /* */ } finally { setLoading(false); }
  }, [recordId, onCount]);
  useEffect(() => { void load(); }, [load]);

  async function add() {
    if (!body.trim()) return;
    setBusy(true); setErr('');
    try { await createNote(recordId, body.trim()); setBody(''); await load(); }
    catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  }
  async function saveEdit() {
    if (!editing || !editing.body.trim()) return;
    setBusy(true); setErr('');
    try { await updateNote(recordId, editing.id, editing.body.trim()); setEditing(null); await load(); }
    catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  }
  async function remove(id: string) {
    setErr('');
    try { await deleteNote(recordId, id); await load(); } catch (e) { setErr(errMsg(e)); }
  }

  return (
    <div className="min-h-[360px] px-4 py-4">
      <div className="mb-4 rounded-lg border border-gray-200 bg-white p-2">
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Add a note…" className="w-full resize-y rounded-md border border-gray-200 px-2.5 py-1.5 text-[13px] text-gray-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
        <div className="mt-1.5 flex items-center justify-between">
          {err ? <span className="text-[12px] text-red-600">{err}</span> : <span />}
          <button type="button" onClick={add} disabled={busy || !body.trim()} className="inline-flex h-7 items-center gap-1.5 rounded-md bg-blue-600 px-2.5 text-[12.5px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <StickyNote className="h-3.5 w-3.5" />} Add note</button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-[13px] text-gray-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</div>
      ) : notes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-[13px] text-gray-500">No notes yet.</div>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className={`rounded-lg border px-3 py-2 ${n.deleted ? 'border-gray-100 bg-gray-50' : 'border-gray-200 bg-white'}`}>
              <div className="mb-1 flex items-center gap-2 text-[12px] text-gray-500">
                <span className="font-medium text-gray-700">{n.author?.name ?? n.author?.email ?? 'Someone'}</span>
                <span>{timeAgo(n.createdAt)}</span>
                {n.edited && !n.deleted ? <span className="text-gray-400">· edited</span> : null}
                {canEdit(n) ? (
                  <span className="ml-auto flex items-center gap-1">
                    <button type="button" onClick={() => setEditing({ id: n.id, body: n.body ?? '' })} className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700"><Pencil className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => remove(n.id)} className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                  </span>
                ) : null}
              </div>
              {editing?.id === n.id ? (
                <div>
                  <textarea value={editing.body} onChange={(e) => setEditing({ id: n.id, body: e.target.value })} rows={2} className="w-full resize-y rounded-md border border-blue-200 px-2 py-1 text-[13px] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                  <div className="mt-1 flex gap-1.5">
                    <button type="button" onClick={saveEdit} disabled={busy} className="inline-flex h-6 items-center gap-1 rounded bg-blue-600 px-2 text-[12px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50"><Check className="h-3 w-3" /> Save</button>
                    <button type="button" onClick={() => setEditing(null)} className="inline-flex h-6 items-center gap-1 rounded border border-gray-200 px-2 text-[12px] text-gray-600 hover:bg-gray-50"><X className="h-3 w-3" /> Cancel</button>
                  </div>
                </div>
              ) : n.deleted ? (
                <p className="text-[13px] italic text-gray-400">{n.placeholder ?? 'This note was deleted.'}</p>
              ) : (
                <p className="whitespace-pre-wrap text-[13px] text-gray-800">{n.body}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
