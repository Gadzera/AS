'use client';

// M24-1: AND/OR конструктор фильтра (advanced). Строит ТОЛЬКО дерево (CrmFilterNode) и отдаёт его наверх —
// никакого клиентского предиката: backend оценивает дерево через recordFilter.ts (GPT-правило #6).
import { useMemo } from 'react';
import { Plus, X, FolderPlus } from 'lucide-react';
import type { CrmAttribute, CrmFilterNode, CrmFilterLeaf, CrmFilterGroup, CrmFilterOp } from '@/lib/crmApi';
import { isFilterGroup } from '@/lib/crmApi';

const MAX_DEPTH = 5;

const OP_LABEL: Record<CrmFilterOp, string> = {
  eq: '=', neq: '≠', contains: 'contains', gt: '>', lt: '<', in: 'is any of', is_empty: 'is empty', is_not_empty: 'is not empty',
};

// Операторы по типу — зеркало backend operatorSupportsType (иначе UI предложит то, что бэк отвергнет 422).
function opsForType(type?: string): CrmFilterOp[] {
  switch (type) {
    case 'TEXT': case 'LONG_TEXT': case 'EMAIL': case 'PHONE': case 'URL':
      return ['eq', 'neq', 'contains', 'is_empty', 'is_not_empty'];
    case 'NUMBER': case 'CURRENCY': case 'DATE': case 'DATETIME':
      return ['eq', 'neq', 'gt', 'lt', 'is_empty', 'is_not_empty'];
    case 'SELECT': case 'USER':
      return ['eq', 'neq', 'in', 'is_empty', 'is_not_empty'];
    case 'MULTI_SELECT': case 'RELATIONSHIP':
      return ['in', 'is_empty', 'is_not_empty'];
    case 'BOOLEAN':
      return ['eq', 'neq', 'is_empty', 'is_not_empty'];
    default:
      return ['eq', 'neq', 'contains', 'is_empty', 'is_not_empty'];
  }
}

const needsValue = (op: CrmFilterOp) => op !== 'is_empty' && op !== 'is_not_empty';

// ── immutable обновление узла по пути (массив индексов внутри children) ──
function updateAt(node: CrmFilterNode, path: number[], fn: (n: CrmFilterNode) => CrmFilterNode | null): CrmFilterNode | null {
  if (path.length === 0) return fn(node);
  if (!isFilterGroup(node)) return node;
  const [head, ...rest] = path;
  const children = node.children
    .map((c, i) => (i === head ? updateAt(c, rest, fn) : c))
    .filter((c): c is CrmFilterNode => c !== null);
  return { ...node, children };
}

function depthOf(path: number[]): number { return path.length; }

export default function FilterTreeBuilder({
  attrs,
  value,
  onChange,
}: {
  attrs: CrmAttribute[];
  value: CrmFilterNode | null;
  onChange: (next: CrmFilterNode | null) => void;
}) {
  const attrByKey = useMemo(() => new Map(attrs.map((a) => [a.key, a])), [attrs]);
  const firstAttr = attrs[0];

  if (!value || !isFilterGroup(value)) {
    return (
      <div className="p-3">
        <p className="mb-2 text-[12px] text-ink-muted">Build an advanced filter with AND / OR groups.</p>
        <button
          type="button"
          disabled={!firstAttr}
          onClick={() => onChange({ op: 'AND', children: firstAttr ? [{ attributeKey: firstAttr.key, op: 'eq', value: '' }] : [] })}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 text-[12px] font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-50"
        >
          <Plus size={13} /> Add filter
        </button>
      </div>
    );
  }

  const setRoot = (next: CrmFilterNode | null) => onChange(next && isFilterGroup(next) && next.children.length === 0 ? null : next);
  const mutate = (path: number[], fn: (n: CrmFilterNode) => CrmFilterNode | null) => setRoot(updateAt(value, path, fn));

  function Group({ group, path }: { group: CrmFilterGroup; path: number[] }) {
    const depth = depthOf(path);
    const isRoot = depth === 0;
    return (
      <div className={['rounded-lg border', isRoot ? 'border-line bg-surface' : 'border-line bg-surface-2/40', 'p-2'].join(' ')}>
        <div className="mb-2 flex items-center gap-2">
          <div className="inline-flex items-center rounded-md border border-line bg-surface p-0.5" role="group" aria-label="Group logic">
            {(['AND', 'OR'] as const).map((op) => (
              <button
                key={op}
                type="button"
                onClick={() => mutate(path, (n) => (isFilterGroup(n) ? { ...n, op } : n))}
                className={['h-6 rounded px-2 text-[11px] font-bold transition-colors', group.op === op ? 'bg-brand-600 text-white' : 'text-ink-muted hover:text-ink'].join(' ')}
              >
                {op}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-ink-subtle">{group.op === 'AND' ? 'all conditions match' : 'any condition matches'}</span>
          {!isRoot && (
            <button type="button" onClick={() => mutate(path.slice(0, -1), (parent) => (isFilterGroup(parent) ? { ...parent, children: parent.children.filter((_, i) => i !== path[path.length - 1]) } : parent))} className="ml-auto flex h-6 w-6 items-center justify-center rounded text-ink-subtle hover:bg-rose-50 hover:text-rose-600" title="Remove group">
              <X size={13} />
            </button>
          )}
        </div>

        <div className="space-y-1.5 pl-2">
          {group.children.map((child, i) =>
            isFilterGroup(child) ? (
              <Group key={i} group={child} path={[...path, i]} />
            ) : (
              <Leaf key={i} leaf={child} path={[...path, i]} />
            ),
          )}
        </div>

        <div className="mt-2 flex items-center gap-1.5 pl-2">
          <button
            type="button"
            disabled={!firstAttr}
            onClick={() => mutate(path, (n) => (isFilterGroup(n) ? { ...n, children: [...n.children, { attributeKey: firstAttr!.key, op: 'eq', value: '' }] } : n))}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-line bg-surface px-2 text-[11.5px] font-semibold text-ink-muted hover:bg-surface-2 disabled:opacity-50"
          >
            <Plus size={12} /> Condition
          </button>
          <button
            type="button"
            disabled={depth >= MAX_DEPTH - 1 || !firstAttr}
            title={depth >= MAX_DEPTH - 1 ? `Max nesting is ${MAX_DEPTH} levels` : 'Add nested group'}
            onClick={() => mutate(path, (n) => (isFilterGroup(n) ? { ...n, children: [...n.children, { op: 'OR', children: [{ attributeKey: firstAttr!.key, op: 'eq', value: '' }] }] } : n))}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-line bg-surface px-2 text-[11.5px] font-semibold text-ink-muted hover:bg-surface-2 disabled:opacity-50"
          >
            <FolderPlus size={12} /> Group
          </button>
        </div>
      </div>
    );
  }

  function Leaf({ leaf, path }: { leaf: CrmFilterLeaf; path: number[] }) {
    const attr = attrByKey.get(leaf.attributeKey);
    const ops = opsForType(attr?.type);
    const opOk = ops.includes(leaf.op);
    const options = attr?.options ?? [];

    const set = (patch: Partial<CrmFilterLeaf>) => mutate(path, (n) => (isFilterGroup(n) ? n : { ...n, ...patch }));

    return (
      <div className="flex flex-wrap items-center gap-1.5 rounded-md bg-surface px-1.5 py-1">
        <select
          value={leaf.attributeKey}
          onChange={(e) => {
            const nextAttr = attrByKey.get(e.target.value);
            const nextOps = opsForType(nextAttr?.type);
            set({ attributeKey: e.target.value, op: nextOps.includes(leaf.op) ? leaf.op : nextOps[0], value: '' });
          }}
          className="h-7 rounded-md border border-line bg-[var(--surface)] px-1.5 text-[11.5px] text-ink focus:border-brand-400 focus:outline-none"
        >
          {attrs.map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}
        </select>

        <select
          value={leaf.op}
          onChange={(e) => set({ op: e.target.value as CrmFilterOp, value: '' })}
          className={['h-7 rounded-md border bg-[var(--surface)] px-1.5 text-[11.5px] focus:border-brand-400 focus:outline-none', opOk ? 'border-line text-ink' : 'border-rose-300 text-rose-600'].join(' ')}
        >
          {ops.map((o) => <option key={o} value={o}>{OP_LABEL[o]}</option>)}
        </select>

        {needsValue(leaf.op) && (
          leaf.op === 'in' ? (
            <input
              value={Array.isArray(leaf.value) ? (leaf.value as unknown[]).join(', ') : String(leaf.value ?? '')}
              onChange={(e) => set({ value: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
              placeholder="val1, val2"
              className="h-7 w-32 rounded-md border border-line bg-[var(--surface)] px-2 text-[11.5px] text-ink placeholder:text-ink-subtle focus:border-brand-400 focus:outline-none"
            />
          ) : attr?.type === 'SELECT' && options.length ? (
            <select value={String(leaf.value ?? '')} onChange={(e) => set({ value: e.target.value })} className="h-7 rounded-md border border-line bg-[var(--surface)] px-1.5 text-[11.5px] text-ink focus:border-brand-400 focus:outline-none">
              <option value="">—</option>
              {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : attr?.type === 'BOOLEAN' ? (
            <select value={String(leaf.value ?? '')} onChange={(e) => set({ value: e.target.value })} className="h-7 rounded-md border border-line bg-[var(--surface)] px-1.5 text-[11.5px] text-ink focus:border-brand-400 focus:outline-none">
              <option value="">—</option><option value="true">true</option><option value="false">false</option>
            </select>
          ) : (
            <input
              type={attr?.type === 'NUMBER' || attr?.type === 'CURRENCY' ? 'number' : attr?.type === 'DATE' || attr?.type === 'DATETIME' ? 'date' : 'text'}
              value={typeof leaf.value === 'string' || typeof leaf.value === 'number' ? String(leaf.value) : ''}
              onChange={(e) => set({ value: e.target.value })}
              placeholder="value"
              className="h-7 w-32 rounded-md border border-line bg-[var(--surface)] px-2 text-[11.5px] text-ink placeholder:text-ink-subtle focus:border-brand-400 focus:outline-none"
            />
          )
        )}

        <button type="button" onClick={() => mutate(path.slice(0, -1), (parent) => (isFilterGroup(parent) ? { ...parent, children: parent.children.filter((_, i) => i !== path[path.length - 1]) } : parent))} className="ml-auto flex h-6 w-6 items-center justify-center rounded text-ink-subtle hover:bg-rose-50 hover:text-rose-600" title="Remove condition">
          <X size={12} />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Group group={value} path={[]} />
      <button type="button" onClick={() => onChange(null)} className="text-[11px] font-medium text-ink-subtle hover:text-rose-600">Clear advanced filter</button>
    </div>
  );
}
