'use client';

/**
 * Settings → Teams (M21-2, S353/S356). Создание команд, участники, expert-группы (isExternal).
 * Команда = область Team для permission-грантов. Expert (isExternal) → участники не наследуют
 * workspace-дефолты (доступ только по явным грантам, иначе NONE). Управление — OWNER/ADMIN.
 */
import { useCallback, useEffect, useState } from 'react';
import { Users, Plus, Loader2, Trash2, ShieldAlert, X, Check, UserPlus } from 'lucide-react';
import { teamsApi, type TeamSummary, type OrgUser } from '@/lib/api';

export default function TeamsManager({ canManage }: { canManage: boolean }) {
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newExpert, setNewExpert] = useState(false);
  const [busy, setBusy] = useState('');
  const [addToTeam, setAddToTeam] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    teamsApi.list().then((d) => { setTeams(d.teams); setUsers(d.users); setForbidden(false); })
      .catch((e) => { if (e?.response?.status === 403) setForbidden(true); })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? users.find((u) => u.id === id)?.email ?? id;

  async function createTeam() {
    if (!newName.trim()) return;
    setCreating(true);
    try { await teamsApi.create({ name: newName.trim(), isExternal: newExpert }); setNewName(''); setNewExpert(false); load(); }
    catch (e) { const err = e as { response?: { data?: { error?: string } } }; alert(err.response?.data?.error || 'Could not create team'); }
    finally { setCreating(false); }
  }
  async function removeTeam(t: TeamSummary) {
    if (!confirm(`Delete team “${t.name}”? Its permission grants will be removed.`)) return;
    setBusy(t.id); try { await teamsApi.remove(t.id); load(); } finally { setBusy(''); }
  }
  async function toggleExpert(t: TeamSummary) {
    setBusy(t.id); try { await teamsApi.update(t.id, { isExternal: !t.isExternal }); load(); } finally { setBusy(''); }
  }
  async function addMember(teamId: string, userId: string) {
    setBusy(teamId + userId); try { await teamsApi.addMembers(teamId, [userId]); load(); } finally { setBusy(''); }
  }
  async function removeMember(teamId: string, userId: string) {
    setBusy(teamId + userId); try { await teamsApi.removeMember(teamId, userId); load(); } finally { setBusy(''); }
  }

  if (loading) return <div className="flex items-center gap-2 py-6 text-[12.5px] text-ink-subtle"><Loader2 size={15} className="animate-spin" /> Loading teams…</div>;
  if (forbidden) return null; // matrix-карточка уже покажет «admins only»

  return (
    <div className="space-y-3">
      {/* создать команду */}
      {canManage && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface-2/30 px-3 py-2.5">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New team name (e.g. Sales-EU)" className="h-8 min-w-[180px] flex-1 rounded-lg border border-line bg-white px-2.5 text-[12.5px] text-ink focus:border-brand-500 focus:outline-none" onKeyDown={(e) => e.key === 'Enter' && createTeam()} />
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11.5px] font-medium text-ink-muted"><input type="checkbox" checked={newExpert} onChange={(e) => setNewExpert(e.target.checked)} className="h-3.5 w-3.5 rounded border-line text-amber-600" /> Expert group (external)</label>
          <button type="button" disabled={creating || !newName.trim()} onClick={createTeam} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-[12px] font-semibold text-white hover:bg-brand-700 disabled:opacity-50">{creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Create team</button>
        </div>
      )}

      {teams.length === 0 ? (
        <p className="py-3 text-[12.5px] text-ink-subtle">No teams yet. Create one to grant team-level access (S350) or set up an external expert group (S356).</p>
      ) : teams.map((t) => {
        const nonMembers = users.filter((u) => !t.memberIds.includes(u.id));
        return (
          <div key={t.id} className="rounded-xl border border-line bg-surface p-3">
            <div className="flex items-center gap-2">
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${t.isExternal ? 'bg-amber-50 text-amber-600' : 'bg-brand-50 text-brand-600'}`}><Users size={15} /></span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-[13px] font-bold text-ink">{t.name}{t.isExternal && <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700"><ShieldAlert size={10} /> Expert · default no access</span>}</p>
                <p className="text-[11px] text-ink-subtle">{t.memberIds.length} member{t.memberIds.length === 1 ? '' : 's'}</p>
              </div>
              {canManage && (
                <>
                  <button type="button" onClick={() => toggleExpert(t)} disabled={busy === t.id} title="Toggle expert (external) group" className="inline-flex h-7 items-center gap-1 rounded-lg border border-line bg-surface px-2 text-[11px] font-semibold text-ink-muted hover:bg-surface-2">{t.isExternal ? 'Make internal' : 'Make expert'}</button>
                  <button type="button" onClick={() => removeTeam(t)} disabled={busy === t.id} className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-subtle hover:bg-rose-50 hover:text-rose-600"><Trash2 size={13} /></button>
                </>
              )}
            </div>
            {/* участники */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {t.memberIds.map((uid) => (
                <span key={uid} className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink">
                  {userName(uid)}
                  {canManage && <button type="button" onClick={() => removeMember(t.id, uid)} className="text-ink-subtle hover:text-rose-600"><X size={11} /></button>}
                </span>
              ))}
              {canManage && nonMembers.length > 0 && (
                <div className="relative">
                  <button type="button" onClick={() => setAddToTeam(addToTeam === t.id ? null : t.id)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-line px-2 py-0.5 text-[11px] font-semibold text-brand-700 hover:bg-brand-50"><UserPlus size={11} /> Add</button>
                  {addToTeam === t.id && (
                    <div className="absolute z-10 mt-1 max-h-44 w-52 overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-lg">
                      {nonMembers.map((u) => (
                        <button key={u.id} type="button" onClick={() => { addMember(t.id, u.id); setAddToTeam(null); }} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-ink hover:bg-surface-2">
                          <Check size={12} className="text-ink-subtle" /> <span className="min-w-0 flex-1 truncate">{u.name}</span> <span className="rounded bg-surface-2 px-1 text-[9px] font-bold text-ink-subtle">{u.role}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
