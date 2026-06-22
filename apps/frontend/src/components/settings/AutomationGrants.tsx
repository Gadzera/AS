'use client';

/**
 * Settings → Automations access (M21-2, S352). Доступ КАЖДОГО воркфлоу к Objects/Lists (None/Read/Read+write),
 * независимо от триггерящего пользователя. Без гранта мутирующий шаг падает PERMISSION_DENIED.
 * Управление — OWNER/ADMIN.
 */
import { useCallback, useEffect, useState } from 'react';
import { Loader2, Workflow as WorkflowIcon, Lock } from 'lucide-react';
import { permissionsApi, type PermissionMatrix, type EntityKind } from '@/lib/api';

type AutoLevel = 'NONE' | 'READ' | 'READ_WRITE';
const AUTO_LEVELS: AutoLevel[] = ['NONE', 'READ', 'READ_WRITE'];
const AUTO_LABEL: Record<AutoLevel, string> = { NONE: 'No access', READ: 'Read only', READ_WRITE: 'Read & write' };
const KINDS: EntityKind[] = ['OBJECT', 'LIST'];
const KIND_LABEL: Record<string, string> = { OBJECT: 'Objects', LIST: 'Lists' };

export default function AutomationGrants({ canManage }: { canManage: boolean }) {
  const [matrix, setMatrix] = useState<PermissionMatrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    permissionsApi.matrix().then((m) => { setMatrix(m); setForbidden(false); })
      .catch((e) => { if (e?.response?.status === 403) setForbidden(true); })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  // уровень automation-гранта воркфлоу на вид (kind-default '*'); нет гранта → NONE
  const levelOf = (workflowId: string, kind: EntityKind): AutoLevel =>
    (matrix?.automationGrants.find((g) => g.workflowId === workflowId && g.entityKind === kind && g.entityKey === '*')?.level as AutoLevel) ?? 'NONE';

  async function setLevel(workflowId: string, kind: EntityKind, level: AutoLevel) {
    if (!canManage) return;
    setBusy(`${workflowId}:${kind}`);
    try {
      if (level === 'NONE') await permissionsApi.clearAutomation({ workflowId, entityKind: kind, entityKey: '*' });
      else await permissionsApi.setAutomation({ workflowId, entityKind: kind, entityKey: '*', level });
      load();
    } finally { setBusy(''); }
  }

  if (loading) return <div className="flex items-center gap-2 py-6 text-[12.5px] text-ink-subtle"><Loader2 size={15} className="animate-spin" /> Loading automations…</div>;
  if (forbidden) return null;
  const workflows = matrix?.entities.WORKFLOW ?? [];
  if (!workflows.length) return <p className="py-3 text-[12.5px] text-ink-subtle">No workflows yet.</p>;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2/30 px-4 py-2.5 text-[12px] text-ink-muted">
        <Lock size={14} className="text-brand-600" /> A workflow can only create/update/archive records or change list entries on entities it’s granted here. No grant → the mutating step fails with PERMISSION_DENIED (never silently).
      </div>
      {workflows.map((w) => (
        <div key={w.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-muted"><WorkflowIcon size={15} /></span>
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-ink">{w.name}</span>
          {KINDS.map((kind) => {
            const cur = levelOf(w.id, kind);
            return (
              <div key={kind} className="inline-flex items-center gap-1.5">
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.03em] text-ink-subtle">{KIND_LABEL[kind]}</span>
                <select value={cur} disabled={!canManage || busy === `${w.id}:${kind}`} onChange={(e) => setLevel(w.id, kind, e.target.value as AutoLevel)} className="h-7 rounded-lg border border-line bg-white px-1.5 text-[11px] font-semibold text-ink focus:border-brand-500 focus:outline-none disabled:opacity-50">
                  {AUTO_LEVELS.map((l) => <option key={l} value={l}>{AUTO_LABEL[l]}</option>)}
                </select>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
