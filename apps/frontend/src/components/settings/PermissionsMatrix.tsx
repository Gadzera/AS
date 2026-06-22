'use client';

/**
 * Settings → Permissions matrix (M21-1, S345/S346/S348/S349/S355).
 * Workspace-дефолты по 5 видам сущностей (4 уровня NONE/READ/READ_WRITE/FULL) + per-entity overrides.
 * Применяется СРАЗУ (DB-resolveAccess). Управление — только OWNER/ADMIN (иначе backend 403).
 * Team/Individual overrides + automation grants + expert groups — в M21-2.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ShieldCheck, Loader2, ChevronDown, ChevronRight, Database, List as ListIcon, LayoutDashboard, Workflow as WorkflowIcon, Send, Lock, Users } from 'lucide-react';
import { permissionsApi, type PermissionMatrix, type AccessLevel, type EntityKind, type PermissionScope } from '@/lib/api';

const LEVELS: AccessLevel[] = ['NONE', 'READ', 'READ_WRITE', 'FULL'];
const LEVEL_LABEL: Record<AccessLevel, string> = { NONE: 'No access', READ: 'Read only', READ_WRITE: 'Read & write', FULL: 'Full access' };
const LEVEL_TONE: Record<AccessLevel, string> = { NONE: 'bg-surface-2 text-ink-subtle', READ: 'bg-sky-50 text-sky-700 ring-sky-200', READ_WRITE: 'bg-emerald-50 text-emerald-700 ring-emerald-200', FULL: 'bg-violet-50 text-violet-700 ring-violet-200' };
const KIND_META: Record<EntityKind, { label: string; icon: React.ReactNode; hint: string }> = {
  OBJECT: { label: 'Objects', icon: <Database size={15} />, hint: 'Companies, People, Deals & custom objects + their records' },
  LIST: { label: 'Lists', icon: <ListIcon size={15} />, hint: 'Saved record collections' },
  DASHBOARD: { label: 'Dashboards & reports', icon: <LayoutDashboard size={15} />, hint: 'Private by default — visible only to the creator unless granted' },
  WORKFLOW: { label: 'Workflows', icon: <WorkflowIcon size={15} />, hint: 'Automations' },
  SEQUENCE: { label: 'Sequences', icon: <Send size={15} />, hint: 'Outbound campaigns' },
};

export default function PermissionsMatrix({ canManage }: { canManage: boolean }) {
  const [matrix, setMatrix] = useState<PermissionMatrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [busyKey, setBusyKey] = useState('');
  const [expanded, setExpanded] = useState<EntityKind | null>(null);
  // субъект per-entity override: Workspace default / конкретная команда / конкретный участник
  const [subjectKey, setSubjectKey] = useState('workspace');

  const load = useCallback(() => {
    setLoading(true);
    permissionsApi.matrix()
      .then((m) => { setMatrix(m); setForbidden(false); })
      .catch((e) => { if (e?.response?.status === 403) setForbidden(true); })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  // варианты субъекта override: workspace + команды (Team) + участники-MEMBER (Individual)
  const subjects = useMemo(() => {
    const out: { key: string; scope: PermissionScope; label: string }[] = [{ key: 'workspace', scope: 'WORKSPACE', label: 'Workspace default' }];
    (matrix?.teams ?? []).forEach((t) => out.push({ key: t.subjectKey, scope: 'TEAM', label: `Team: ${t.name}${t.isExternal ? ' (expert)' : ''}` }));
    (matrix?.users ?? []).filter((u) => u.role === 'MEMBER').forEach((u) => out.push({ key: `user:${u.id}`, scope: 'INDIVIDUAL', label: `Individual: ${u.name}` }));
    return out;
  }, [matrix]);
  const subject = subjects.find((s) => s.key === subjectKey) ?? subjects[0];

  // override-уровень конкретной сущности для ВЫБРАННОГО субъекта, иначе null=наследует
  const overrideOf = (kind: EntityKind, entityId: string): AccessLevel | null =>
    matrix?.grants.find((g) => g.scope === subject.scope && g.subjectKey === subject.key && g.entityKind === kind && g.entityKey === entityId)?.level ?? null;

  async function setDefault(kind: EntityKind, level: AccessLevel) {
    if (!canManage || !matrix) return;
    setBusyKey(`def:${kind}`);
    try {
      await permissionsApi.setGrant({ scope: 'WORKSPACE', subjectKey: 'workspace', entityKind: kind, entityKey: '*', level });
      setMatrix({ ...matrix, workspaceDefaults: { ...matrix.workspaceDefaults, [kind]: level } });
    } finally { setBusyKey(''); }
  }
  async function setOverride(kind: EntityKind, entityId: string, level: AccessLevel | 'INHERIT') {
    if (!canManage) return;
    setBusyKey(`${kind}:${entityId}`);
    try {
      if (level === 'INHERIT') await permissionsApi.clearGrant({ scope: subject.scope, subjectKey: subject.key, entityKind: kind, entityKey: entityId });
      else await permissionsApi.setGrant({ scope: subject.scope, subjectKey: subject.key, entityKind: kind, entityKey: entityId, level });
      load();
    } finally { setBusyKey(''); }
  }

  if (loading) return <div className="flex items-center gap-2 py-6 text-[12.5px] text-ink-subtle"><Loader2 size={15} className="animate-spin" /> Loading permissions…</div>;
  if (forbidden) return <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2/40 px-4 py-3 text-[12.5px] text-ink-muted"><Lock size={15} className="text-ink-subtle" /> Only the owner or an admin can view and manage permissions.</div>;
  if (!matrix) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2/30 px-4 py-2.5 text-[12px] text-ink-muted">
        <ShieldCheck size={15} className="text-brand-600" />
        Workspace access = default level for every member on each entity type. Owners & admins always have full access. Members get exactly what’s granted here (per-entity overrides take precedence).
      </div>

      {matrix.kinds.map((kind) => {
        const def = matrix.workspaceDefaults[kind] ?? 'NONE';
        const ents = matrix.entities[kind] ?? [];
        const overrides = ents.filter((e) => overrideOf(kind, e.id) != null).length;
        const isOpen = expanded === kind;
        return (
          <div key={kind} className="overflow-hidden rounded-xl border border-line bg-surface">
            {/* строка вида: дефолт-селектор */}
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-muted">{KIND_META[kind].icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-ink">{KIND_META[kind].label}</p>
                <p className="truncate text-[11px] text-ink-subtle">{KIND_META[kind].hint}</p>
              </div>
              <LevelPicker value={def} onChange={(l) => setDefault(kind, l)} disabled={!canManage || busyKey === `def:${kind}`} busy={busyKey === `def:${kind}`} />
              <button type="button" onClick={() => setExpanded(isOpen ? null : kind)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-surface px-2 text-[11.5px] font-semibold text-ink-muted hover:bg-surface-2">
                {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />} {ents.length} item{ents.length === 1 ? '' : 's'}{overrides ? ` · ${overrides} override${overrides === 1 ? '' : 's'}` : ''}
              </button>
            </div>

            {/* per-entity overrides */}
            {isOpen && (
              <div className="border-t border-line bg-surface-2/30 px-4 py-2">
                {/* субъект override: Workspace / Team / Individual (S347/S350/S351) */}
                <div className="mb-2 flex items-center gap-2 text-[11px] text-ink-muted">
                  <Users size={12} className="text-ink-subtle" /> Override for
                  <select value={subjectKey} onChange={(e) => setSubjectKey(e.target.value)} className="h-7 rounded-lg border border-line bg-white px-1.5 text-[11px] font-semibold text-ink focus:border-brand-500 focus:outline-none">
                    {subjects.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                  <span className="text-ink-subtle">· precedence: Individual &gt; Team &gt; Workspace</span>
                </div>
                {ents.length === 0 ? (
                  <p className="py-2 text-[11.5px] text-ink-subtle">No {KIND_META[kind].label.toLowerCase()} yet.</p>
                ) : (
                  <div className="space-y-1">
                    {ents.map((e) => {
                      const ov = overrideOf(kind, e.id);
                      return (
                        <div key={e.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface">
                          <span className="min-w-0 flex-1 truncate text-[12px] text-ink">{e.name}</span>
                          {ov == null ? <span className="text-[10.5px] text-ink-subtle">{subject.scope === 'WORKSPACE' ? `inherits ${LEVEL_LABEL[def].toLowerCase()}` : 'inherit'}</span> : <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-inset ${LEVEL_TONE[ov]}`}>{LEVEL_LABEL[ov]}</span>}
                          <select
                            value={ov ?? 'INHERIT'}
                            disabled={!canManage || busyKey === `${kind}:${e.id}`}
                            onChange={(ev) => setOverride(kind, e.id, ev.target.value as AccessLevel | 'INHERIT')}
                            className="h-7 rounded-lg border border-line bg-white px-1.5 text-[11px] font-semibold text-ink focus:border-brand-500 focus:outline-none disabled:opacity-50"
                          >
                            <option value="INHERIT">Inherit</option>
                            {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function LevelPicker({ value, onChange, disabled, busy }: { value: AccessLevel; onChange: (l: AccessLevel) => void; disabled?: boolean; busy?: boolean }) {
  return (
    <div className="inline-flex shrink-0 items-center gap-1">
      {busy && <Loader2 size={13} className="animate-spin text-ink-subtle" />}
      <div className="inline-flex rounded-lg border border-line bg-surface-2/60 p-0.5">
        {LEVELS.map((l) => (
          <button
            key={l}
            type="button"
            disabled={disabled}
            onClick={() => onChange(l)}
            title={LEVEL_LABEL[l]}
            className={['rounded-md px-2 py-1 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed', value === l ? `ring-1 ring-inset ${LEVEL_TONE[l]}` : 'text-ink-subtle hover:text-ink'].join(' ')}
          >
            {LEVEL_LABEL[l]}
          </button>
        ))}
      </div>
    </div>
  );
}
