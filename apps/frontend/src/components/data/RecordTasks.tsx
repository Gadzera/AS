'use client';

/**
 * RecordTasks (M27-2) — задачи записи. Create/assign/due/priority/status. Complete-toggle, delete.
 * TASK_ASSIGNED notification шлёт бэкенд (не себе). Права: creator/assignee/OWNER/ADMIN (бэкенд enforce).
 */
import { useCallback, useEffect, useState } from 'react';
import { Loader2, Trash2, SquareCheckBig, Square, Plus, CalendarClock, User as UserIcon } from 'lucide-react';
import { listTasks, createTask, updateTask, deleteTask, type CrmTask, type CrmTaskPriority } from '@/lib/crmApi';
import { teamApi } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';

function errMsg(e: unknown): string {
  return (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Something went wrong';
}
const PRIORITIES: CrmTaskPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
const PRIORITY_CLS: Record<CrmTaskPriority, string> = {
  LOW: 'bg-gray-100 text-gray-600', NORMAL: 'bg-blue-50 text-blue-700', HIGH: 'bg-amber-50 text-amber-700', URGENT: 'bg-red-50 text-red-700',
};
function dueLabel(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

export default function RecordTasks({ recordId, onCount }: { recordId: string; onCount?: (n: number) => void }) {
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [members, setMembers] = useState<{ id: string; name: string | null; email: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [priority, setPriority] = useState<CrmTaskPriority>('NORMAL');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const me = getStoredUser();
  const isManager = me?.role === 'OWNER' || me?.role === 'ADMIN';
  const canEdit = (t: CrmTask) => isManager || t.createdBy?.id === me?.id || t.assignee?.id === me?.id;

  const load = useCallback(async () => {
    setLoading(true);
    try { const ts = await listTasks(recordId); setTasks(ts); onCount?.(ts.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELED').length); }
    catch { /* */ } finally { setLoading(false); }
  }, [recordId, onCount]);
  useEffect(() => { void load(); }, [load]);
  // только АКТИВНЫЕ участники — бэкенд всё равно отклонит неактивного 422 INVALID_ASSIGNEE (убираем рассинхрон UX).
  useEffect(() => { teamApi.members().then((r) => setMembers(r.members.filter((m) => m.isActive !== false))).catch(() => {}); }, []);

  async function add() {
    if (!title.trim()) return;
    setBusy(true); setErr('');
    try {
      await createTask(recordId, { title: title.trim(), assigneeId: assigneeId || null, priority, dueAt: dueAt ? new Date(dueAt + 'T00:00:00.000Z').toISOString() : null });
      setTitle(''); setAssigneeId(''); setDueAt(''); setPriority('NORMAL'); await load();
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  }
  async function toggleComplete(t: CrmTask) {
    setErr('');
    try { await updateTask(recordId, t.id, { status: t.status === 'COMPLETED' ? 'OPEN' : 'COMPLETED' }); await load(); }
    catch (e) { setErr(errMsg(e)); }
  }
  async function reassign(t: CrmTask, uid: string) {
    setErr('');
    try { await updateTask(recordId, t.id, { assigneeId: uid || null }); await load(); } catch (e) { setErr(errMsg(e)); }
  }
  async function remove(id: string) {
    setErr('');
    try { await deleteTask(recordId, id); await load(); } catch (e) { setErr(errMsg(e)); }
  }

  return (
    <div className="min-h-[360px] px-4 py-4">
      <div className="mb-4 rounded-lg border border-gray-200 bg-white p-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New task…" className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-[13px] text-gray-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className="h-7 rounded-md border border-gray-200 bg-white px-1.5 text-[12px] text-gray-700">
            <option value="">Unassigned</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name || m.email}</option>)}
          </select>
          <select value={priority} onChange={(e) => setPriority(e.target.value as CrmTaskPriority)} className="h-7 rounded-md border border-gray-200 bg-white px-1.5 text-[12px] text-gray-700">
            {PRIORITIES.map((p) => <option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</option>)}
          </select>
          <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="h-7 rounded-md border border-gray-200 bg-white px-1.5 text-[12px] text-gray-700" />
          <button type="button" onClick={add} disabled={busy || !title.trim()} className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-md bg-blue-600 px-2.5 text-[12.5px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add</button>
        </div>
        {err ? <p className="mt-1 text-[12px] text-red-600">{err}</p> : null}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-[13px] text-gray-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</div>
      ) : tasks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-[13px] text-gray-500">No tasks yet.</div>
      ) : (
        <ul className="space-y-1.5">
          {tasks.map((t) => {
            const done = t.status === 'COMPLETED';
            const editable = canEdit(t);
            return (
              <li key={t.id} className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${done ? 'border-gray-100 bg-gray-50' : 'border-gray-200 bg-white'}`}>
                <button type="button" disabled={!editable} onClick={() => toggleComplete(t)} className="mt-0.5 text-gray-400 hover:text-blue-600 disabled:opacity-40">{done ? <SquareCheckBig className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4" />}</button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[13px] font-medium ${done ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{t.title}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10.5px] font-semibold ${PRIORITY_CLS[t.priority]}`}>{t.priority[0] + t.priority.slice(1).toLowerCase()}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11.5px] text-gray-500">
                    {t.dueAt ? <span className="inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" /> {dueLabel(t.dueAt)}</span> : null}
                    {editable ? (
                      <span className="inline-flex items-center gap-1"><UserIcon className="h-3 w-3" />
                        <select value={t.assignee?.id ?? ''} onChange={(e) => reassign(t, e.target.value)} className="rounded border border-gray-200 bg-white px-1 py-0.5 text-[11px] text-gray-600">
                          <option value="">Unassigned</option>
                          {members.map((m) => <option key={m.id} value={m.id}>{m.name || m.email}</option>)}
                        </select>
                      </span>
                    ) : t.assignee ? <span className="inline-flex items-center gap-1"><UserIcon className="h-3 w-3" /> {t.assignee.name || t.assignee.email}</span> : <span className="text-gray-400">Unassigned</span>}
                  </div>
                </div>
                {editable ? <button type="button" onClick={() => remove(t.id)} className="mt-0.5 flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button> : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
