'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  Database,
  Plus,
  Type,
  AlignLeft,
  Hash,
  DollarSign,
  Calendar,
  Clock,
  ToggleLeft,
  List,
  ListChecks,
  Link2,
  Link as LinkIcon,
  Mail,
  Phone,
  UserCircle,
  Braces,
  MapPin,
  Sparkles,
  Pencil,
  Trash2,
  X,
  Loader2,
  Star,
  ShieldCheck,
  ArrowLeft,
  Lock,
  Building2,
  Users,
  Handshake,
  LayoutGrid,
  Briefcase,
  Box,
  Contact,
  type LucideIcon,
} from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import { getStoredUser } from '@/lib/auth';
import {
  listObjects,
  getObject,
  createObject,
  updateObject,
  archiveObject,
  createAttribute,
  updateAttribute,
  archiveAttribute,
  createAttributeOption,
  archiveAttributeOption,
  type CrmObject,
  type CrmObjectDetail,
  type CrmAttribute,
  type CrmAttributeType,
} from '@/lib/crmApi';

/* ──────────────────────────────────────────────────────────────────────────
   Settings → Data model (S001–S049). Гибкий CRM как в Attio: объекты, атрибуты
   (16 типов), связи. Всё на ЖИВОМ backend (/api/objects ... CRUD). RBAC:
   управлять может OWNER/ADMIN. Светлая Bold-тема (как Data Hub / Cockpit).
   ────────────────────────────────────────────────────────────────────────── */

type AttrMeta = { label: string; icon: ReactNode; group: string; hint: string };
const ATTR_TYPES: Record<CrmAttributeType, AttrMeta> = {
  TEXT: { label: 'Text', icon: <Type size={14} />, group: 'Basic', hint: 'Single line of text' },
  LONG_TEXT: { label: 'Long text', icon: <AlignLeft size={14} />, group: 'Basic', hint: 'Multi-line text / notes' },
  NUMBER: { label: 'Number', icon: <Hash size={14} />, group: 'Basic', hint: 'Integer or decimal' },
  CURRENCY: { label: 'Currency', icon: <DollarSign size={14} />, group: 'Basic', hint: 'Monetary amount' },
  BOOLEAN: { label: 'Checkbox', icon: <ToggleLeft size={14} />, group: 'Basic', hint: 'True / false' },
  DATE: { label: 'Date', icon: <Calendar size={14} />, group: 'Date & time', hint: 'Calendar date' },
  DATETIME: { label: 'Date & time', icon: <Clock size={14} />, group: 'Date & time', hint: 'Date with time' },
  SELECT: { label: 'Select', icon: <List size={14} />, group: 'Choice', hint: 'One option from a list' },
  MULTI_SELECT: { label: 'Multi-select', icon: <ListChecks size={14} />, group: 'Choice', hint: 'Several options from a list' },
  RELATIONSHIP: { label: 'Relationship', icon: <Link2 size={14} />, group: 'Relational', hint: 'Link to another object' },
  USER: { label: 'User', icon: <UserCircle size={14} />, group: 'Relational', hint: 'A workspace teammate' },
  URL: { label: 'URL', icon: <LinkIcon size={14} />, group: 'Contact', hint: 'Web address' },
  EMAIL: { label: 'Email', icon: <Mail size={14} />, group: 'Contact', hint: 'Email address' },
  PHONE: { label: 'Phone', icon: <Phone size={14} />, group: 'Contact', hint: 'Phone number' },
  LOCATION: { label: 'Location', icon: <MapPin size={14} />, group: 'Contact', hint: 'City / address' },
  JSON: { label: 'JSON', icon: <Braces size={14} />, group: 'Advanced', hint: 'Raw structured data' },
};
const ATTR_ORDER: CrmAttributeType[] = ['TEXT', 'LONG_TEXT', 'NUMBER', 'CURRENCY', 'BOOLEAN', 'DATE', 'DATETIME', 'SELECT', 'MULTI_SELECT', 'RELATIONSHIP', 'USER', 'URL', 'EMAIL', 'PHONE', 'LOCATION', 'JSON'];

const AI_TYPES = [
  { value: 'RESEARCH', label: 'Research', hint: 'Agent researches the web/CRM to fill this field' },
  { value: 'CLASSIFY', label: 'Classify', hint: 'Agent picks one option from the list' },
  { value: 'SUMMARIZE', label: 'Summarize', hint: 'Agent summarizes the record' },
  { value: 'PROMPT', label: 'Custom prompt', hint: 'Agent answers your prompt per record' },
] as const;

// Иконка объекта может быть emoji ИЛИ именем lucide ("building-2"). Рендерим корректно оба.
function isEmoji(s?: string | null): boolean {
  return !!s && /\p{Extended_Pictographic}/u.test(s);
}
const LUCIDE_ICONS: Record<string, LucideIcon> = {
  'building-2': Building2, building: Building2, handshake: Handshake, users: Users,
  'user-round': Contact, user: Contact, 'layout-grid': LayoutGrid, briefcase: Briefcase,
  contact: Contact, database: Database,
};
function ObjIcon({ icon, px }: { icon?: string | null; px: number }) {
  if (isEmoji(icon)) return <span style={{ fontSize: px }} className="leading-none">{icon}</span>;
  const Comp = (icon && LUCIDE_ICONS[icon]) || Box;
  return <Comp size={Math.round(px * 0.72)} strokeWidth={1.9} className="text-brand-600" />;
}

function slugify(s: string): string {
  const base = s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return /^[a-z]/.test(base) ? base : (base ? 'f_' + base : '');
}

function TypeBadge({ type }: { type: CrmAttributeType }) {
  const m = ATTR_TYPES[type];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-2/60 px-2 py-0.5 text-[11.5px] font-semibold text-ink-muted">
      <span className="text-brand-600">{m.icon}</span>{m.label}
    </span>
  );
}

function Modal({ open, onClose, title, icon, children, footer, wide }: {
  open: boolean; onClose: () => void; title: string; icon: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0f0f0e]/55 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative z-10 flex max-h-[88vh] w-full ${wide ? 'max-w-[620px]' : 'max-w-[460px]'} flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl`}>
        <div className="flex items-center gap-2.5 border-b border-line px-5 py-3.5">
          <span className="brand-gradient flex h-7 w-7 items-center justify-center rounded-lg text-white">{icon}</span>
          <h2 className="text-[14px] font-bold text-ink">{title}</h2>
          <button type="button" onClick={onClose} className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-ink-subtle hover:bg-surface-2 hover:text-ink"><X size={15} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line bg-surface-2/40 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

function Labeled({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-subtle">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-ink-subtle">{hint}</p>}
    </div>
  );
}
const inputCls = 'h-9 w-full rounded-lg border border-line bg-surface px-3 text-[13px] text-ink outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100';

export default function DataModelPage() {
  const router = useRouter();
  const [objects, setObjects] = useState<CrmObject[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [detail, setDetail] = useState<CrmObjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [toast, setToast] = useState('');

  const [objModal, setObjModal] = useState<null | { mode: 'create' | 'edit' }>(null);
  const [attrModal, setAttrModal] = useState<null | { mode: 'create' | 'edit'; attr?: CrmAttribute }>(null);
  const [confirm, setConfirm] = useState<null | { kind: 'object' | 'attribute'; id: string; name: string }>(null);
  const [canManage, setCanManage] = useState(true);

  // RBAC: менять модель данных могут только OWNER/ADMIN (бэкенд тоже это форсит, 403).
  useEffect(() => {
    const u = getStoredUser();
    setCanManage(u?.role === 'OWNER' || u?.role === 'ADMIN');
  }, []);

  function showToast(m: string) { setToast(m); window.setTimeout(() => setToast(''), 4000); }

  // Дип-линк ?obj=<key> (из CommandPalette / старых ссылок).
  useEffect(() => {
    const q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('obj') : null;
    if (q) setSelectedKey(q);
  }, []);

  const loadObjects = useCallback(async () => {
    try {
      const objs = await listObjects();
      setObjects(objs);
      setSelectedKey((k) => k ?? objs[0]?.key ?? null);
    } catch { /* no-op */ } finally { setLoading(false); }
  }, []);

  const loadDetail = useCallback(async (key: string) => {
    setDetailLoading(true);
    try { setDetail(await getObject(key)); } catch { setDetail(null); } finally { setDetailLoading(false); }
  }, []);

  useEffect(() => { void loadObjects(); }, [loadObjects]);
  useEffect(() => { if (selectedKey) void loadDetail(selectedKey); }, [selectedKey, loadDetail]);

  const attributes = detail?.attributes ?? [];
  const relationships = useMemo(() => attributes.filter((a) => a.type === 'RELATIONSHIP'), [attributes]);

  async function refresh() {
    await loadObjects();
    if (selectedKey) await loadDetail(selectedKey);
  }

  async function handleDelete() {
    if (!confirm) return;
    try {
      if (confirm.kind === 'object') {
        await archiveObject(confirm.id);
        showToast(`Object “${confirm.name}” archived`);
        setSelectedKey(null);
        const objs = await listObjects();
        setObjects(objs);
        setSelectedKey(objs[0]?.key ?? null);
      } else if (detail) {
        await archiveAttribute(detail.id, confirm.id);
        showToast(`Field “${confirm.name}” deleted`);
        await loadDetail(detail.key);
        await loadObjects();
      }
    } catch (e) {
      showToast(errMsg(e));
    } finally {
      setConfirm(null);
    }
  }

  async function setPrimary(attr: CrmAttribute) {
    if (!detail) return;
    try {
      await updateAttribute(detail.id, attr.id, { isPrimary: true });
      showToast(`“${attr.name}” is now the primary field`);
      await loadDetail(detail.key);
    } catch (e) { showToast(errMsg(e)); }
  }

  return (
    <>
      <Topbar title="Data model" icon={<Database size={18} strokeWidth={1.85} />} />

      <div className="flex min-h-0 flex-1">
        {/* objects list */}
        <aside className="hidden w-[260px] shrink-0 flex-col border-r border-line bg-surface/50 md:flex">
          <div className="flex items-center justify-between px-4 pb-2 pt-4">
            <button type="button" onClick={() => router.push('/settings')} className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-subtle hover:text-brand-700">
              <ArrowLeft size={12} /> Settings
            </button>
            {canManage && (
              <button type="button" onClick={() => setObjModal({ mode: 'create' })} className="inline-flex items-center gap-1 rounded-md border border-brand-200 bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-100">
                <Plus size={12} /> New
              </button>
            )}
          </div>
          <p className="px-4 pb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-subtle">Objects</p>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            {loading ? (
              <div className="space-y-1.5 px-1">{[...Array(5)].map((_, i) => <div key={i} className="skeleton h-10 rounded-lg" />)}</div>
            ) : objects.map((o) => {
              const active = o.key === selectedKey;
              return (
                <button key={o.id} type="button" onClick={() => setSelectedKey(o.key)} className={['group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors', active ? 'sidebar-active-gradient ring-1 ring-inset ring-brand-100' : 'hover:bg-surface-2'].join(' ')}>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface shadow-xs"><ObjIcon icon={o.icon} px={16} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-ink">{o.pluralName}</span>
                    <span className="block truncate text-[11px] text-ink-subtle">{o._count?.records ?? 0} records · {o._count?.attributes ?? 0} fields</span>
                  </span>
                  {o.isSystem
                    ? <Lock size={11} className="shrink-0 text-ink-subtle" />
                    : <span className="shrink-0 rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-violet-700">Custom</span>}
                </button>
              );
            })}
          </div>
        </aside>

        {/* object detail */}
        <main className="min-h-0 flex-1 overflow-y-auto">
          {!detail ? (
            <div className="flex h-full items-center justify-center text-[13px] text-ink-subtle">{detailLoading ? 'Loading…' : 'Select an object'}</div>
          ) : (
            <div className="mx-auto max-w-4xl p-6">
              {/* object header */}
              <div className="mb-5 flex items-start gap-3 rounded-2xl border border-line bg-surface p-5 shadow-sm">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-2"><ObjIcon icon={detail.icon} px={28} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h1 className="text-[19px] font-extrabold tracking-[-0.02em] text-ink">{detail.pluralName}</h1>
                    {detail.isSystem
                      ? <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] font-bold text-ink-subtle"><Lock size={10} /> System</span>
                      : <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10.5px] font-bold uppercase text-violet-700">Custom</span>}
                  </div>
                  <p className="mt-0.5 text-[12.5px] text-ink-muted">{detail.description || `Records of type “${detail.singularName}”.`}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-[11.5px] text-ink-subtle">
                    <span>key <code className="rounded bg-surface-2 px-1 font-mono text-ink-muted">{detail.key}</code></span>
                    <span>{detail._count?.records ?? 0} records</span>
                    <span>{attributes.length} fields</span>
                    <span>{relationships.length} relationships</span>
                  </div>
                </div>
                {canManage && (
                  <div className="flex shrink-0 flex-col gap-2">
                    <button type="button" onClick={() => setObjModal({ mode: 'edit' })} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[12.5px] font-medium text-ink-muted hover:bg-surface-2 hover:text-ink"><Pencil size={13} /> Edit</button>
                    {!detail.isSystem && (
                      <button type="button" onClick={() => setConfirm({ kind: 'object', id: detail.id, name: detail.pluralName })} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[12.5px] font-medium text-rose-600 hover:bg-rose-50"><Trash2 size={13} /> Delete</button>
                    )}
                  </div>
                )}
              </div>

              {/* read-only режим для не OWNER/ADMIN */}
              {!canManage && (
                <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[12.5px] font-medium text-amber-800">
                  <Lock size={14} className="shrink-0" />
                  Read-only — only owners and admins can change the data model. You can view objects and fields.
                </div>
              )}

              {/* attributes */}
              <div className="mb-2.5 flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-subtle">Fields · {attributes.length}</p>
                {canManage && (
                  <button type="button" onClick={() => setAttrModal({ mode: 'create' })} className="brand-gradient inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold text-white shadow-brand hover:-translate-y-0.5 hover:shadow-md transition-all"><Plus size={14} /> Add field</button>
                )}
              </div>

              <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
                <div className="grid grid-cols-[1.4fr_1fr_auto] items-center gap-3 border-b border-line bg-surface-2/40 px-4 py-2 text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-subtle">
                  <span>Field</span><span>Type</span><span className="pr-1 text-right">Actions</span>
                </div>
                {detailLoading ? (
                  <div className="space-y-1 p-3">{[...Array(5)].map((_, i) => <div key={i} className="skeleton h-9 rounded-lg" />)}</div>
                ) : attributes.length === 0 ? (
                  <div className="px-4 py-10 text-center text-[13px] text-ink-muted">No fields yet — click “Add field” to define the first one.</div>
                ) : attributes.map((a) => {
                  // REL-1: reverse-атрибут (config.reverse) — системная обратная сторона связи, read-only.
                  const revCfg = a.config as { reverse?: boolean; reverseOfLabel?: string } | null | undefined;
                  const isReverse = revCfg?.reverse === true;
                  return (
                  <div key={a.id} className="grid grid-cols-[1.4fr_1fr_auto] items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0 hover:bg-brand-50/30">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[13px] font-semibold text-ink">{a.name}</span>
                        {a.isPrimary && <span title="Primary field" className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-amber-700"><Star size={9} /> Primary</span>}
                        {a.aiEnabled && <span title="AI-filled" className="inline-flex items-center gap-0.5 rounded bg-brand-100 px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-brand-700"><Sparkles size={9} /> AI</span>}
                        {isReverse && <span title={`Managed reverse relationship — edit from ${revCfg?.reverseOfLabel ?? 'the source field'}`} className="inline-flex items-center gap-0.5 rounded bg-surface-2 px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-ink-muted"><Lock size={9} /> System · reverse</span>}
                      </div>
                      <code className="text-[11px] font-mono text-ink-subtle">{a.key}</code>
                      {a.type === 'RELATIONSHIP' && relTarget(a) && <span className="ml-1.5 text-[11px] text-ink-subtle">→ {relTarget(a)}</span>}
                      {isReverse && revCfg?.reverseOfLabel && <span className="ml-1.5 text-[11px] text-ink-subtle">reverse of {revCfg.reverseOfLabel}</span>}
                      {(a.type === 'SELECT' || a.type === 'MULTI_SELECT') && (a.options?.length ?? 0) > 0 && (
                        <span className="ml-1.5 text-[11px] text-ink-subtle">{a.options!.length} options</span>
                      )}
                    </div>
                    <div><TypeBadge type={a.type} /></div>
                    <div className="flex items-center justify-end gap-1">
                      {canManage && !isReverse ? (
                        <>
                          {!a.isPrimary && a.type !== 'RELATIONSHIP' && (
                            <button type="button" onClick={() => setPrimary(a)} title="Make primary" className="flex h-7 w-7 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-2 hover:text-amber-600"><Star size={13} /></button>
                          )}
                          <button type="button" onClick={() => setAttrModal({ mode: 'edit', attr: a })} title="Edit" className="flex h-7 w-7 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-2 hover:text-ink"><Pencil size={13} /></button>
                          <button
                            type="button"
                            disabled={a.isPrimary}
                            onClick={() => setConfirm({ kind: 'attribute', id: a.id, name: a.name })}
                            title={a.isPrimary ? 'Primary field can’t be deleted' : 'Delete'}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-ink-subtle hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 disabled:hover:bg-transparent"
                          ><Trash2 size={13} /></button>
                        </>
                      ) : (
                        <span title={isReverse ? 'Managed by the source relationship' : undefined} className="text-[11px] text-ink-subtle">{isReverse ? 'Managed' : '—'}</span>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>

              <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-ink-subtle">
                <ShieldCheck size={13} className="text-brand-600" />
                Fields and objects power the whole CRM — tables, views, the agent’s research and stages. Changes are live.
              </p>
            </div>
          )}
        </main>
      </div>

      {objModal && (
        <ObjectModal
          mode={objModal.mode}
          object={objModal.mode === 'edit' ? detail : null}
          onClose={() => setObjModal(null)}
          onSaved={async (key) => { const created = objModal.mode === 'create'; setObjModal(null); await refresh(); if (key) setSelectedKey(key); showToast(created ? 'Object created' : 'Object updated'); }}
          onError={showToast}
        />
      )}

      {attrModal && detail && (
        <AttributeModal
          mode={attrModal.mode}
          objectId={detail.id}
          objectName={detail.singularName}
          attr={attrModal.attr}
          objects={objects}
          existingKeys={attributes.map((a) => a.key)}
          onClose={() => setAttrModal(null)}
          onSaved={async () => { const created = attrModal.mode === 'create'; setAttrModal(null); await loadDetail(detail.key); await loadObjects(); showToast(created ? 'Field added' : 'Field updated'); }}
          onError={showToast}
        />
      )}

      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm?.kind === 'object' ? 'Delete object' : 'Delete field'}
        icon={<Trash2 size={14} />}
        footer={
          <>
            <button type="button" onClick={() => setConfirm(null)} className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3.5 text-[12.5px] font-medium text-ink-muted hover:bg-surface-2">Cancel</button>
            <button type="button" onClick={handleDelete} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 text-[12.5px] font-semibold text-white hover:bg-rose-700"><Trash2 size={13} /> Delete</button>
          </>
        }
      >
        {confirm && (
          <p className="text-[13px] leading-5 text-ink-muted">
            Archive <span className="font-semibold text-ink">{confirm.name}</span>? It’s removed from the workspace but data is preserved (soft-archive) and can be restored from the database.
          </p>
        )}
      </Modal>

      {toast && (
        <div className="fixed bottom-5 right-5 z-[60] inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[12.5px] font-semibold text-ink shadow-lg">
          <span className="brand-gradient flex h-6 w-6 items-center justify-center rounded-lg text-white"><Database size={12} /></span>
          {toast}
        </div>
      )}
    </>
  );
}

function relTarget(a: CrmAttribute): string | null {
  // Цель связи: сперва из RelationshipDefinition (backend), затем из config.
  const withRel = a as unknown as {
    sourceRelationshipDefinitions?: Array<{ targetObject?: { key?: string; pluralName?: string } }>;
  };
  const def = withRel.sourceRelationshipDefinitions?.[0];
  if (def?.targetObject) return def.targetObject.pluralName ?? def.targetObject.key ?? null;
  const cfg = a.config as { targetObjectKey?: string; relationObjectKey?: string } | null | undefined;
  return cfg?.targetObjectKey ?? cfg?.relationObjectKey ?? null;
}
function errMsg(e: unknown): string {
  const ax = e as { response?: { data?: { error?: string }; status?: number } };
  if (ax?.response?.status === 403) return 'Only owners and admins can change the data model';
  return ax?.response?.data?.error ?? 'Something went wrong';
}

/* ── Object create/edit ─────────────────────────────────────────────────────── */
function ObjectModal({ mode, object, onClose, onSaved, onError }: {
  mode: 'create' | 'edit'; object: CrmObjectDetail | null; onClose: () => void; onSaved: (key?: string) => void; onError: (m: string) => void;
}) {
  const [singular, setSingular] = useState(object?.singularName ?? '');
  const [plural, setPlural] = useState(object?.pluralName ?? '');
  const [key, setKey] = useState(object?.key ?? '');
  const [keyEdited, setKeyEdited] = useState(mode === 'edit');
  const [icon, setIcon] = useState(isEmoji(object?.icon) ? (object!.icon as string) : '📦');
  const [description, setDescription] = useState(object?.description ?? '');
  const [busy, setBusy] = useState(false);

  function onSingular(v: string) {
    setSingular(v);
    if (mode === 'create') {
      const pl = v ? v + 's' : '';
      setPlural(pl);
      if (!keyEdited) setKey(slugify(pl));
    }
  }

  async function save() {
    if (!singular.trim() || !plural.trim()) return;
    setBusy(true);
    try {
      if (mode === 'create') {
        const created = await createObject({ key: key || slugify(plural), singularName: singular, pluralName: plural, description: description || undefined, icon });
        onSaved(created.key);
      } else if (object) {
        await updateObject(object.id, { singularName: singular, pluralName: plural, description: description || null, icon });
        onSaved(object.key);
      }
    } catch (e) { onError(errMsg(e)); } finally { setBusy(false); }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === 'create' ? 'New object' : `Edit ${object?.singularName ?? 'object'}`}
      icon={<Database size={14} />}
      footer={
        <>
          <button type="button" onClick={onClose} className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3.5 text-[12.5px] font-medium text-ink-muted hover:bg-surface-2">Cancel</button>
          <button type="button" onClick={save} disabled={busy || !singular.trim() || !plural.trim()} className="brand-gradient inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[12.5px] font-semibold text-white shadow-brand disabled:opacity-60">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}{mode === 'create' ? 'Create object' : 'Save'}
          </button>
        </>
      }
    >
      <div className="space-y-3.5">
        <div className="flex items-end gap-3">
          <div className="w-16">
            <Labeled label="Icon"><input value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={2} className={`${inputCls} text-center text-[18px]`} /></Labeled>
          </div>
          <div className="flex-1"><Labeled label="Singular name"><input value={singular} onChange={(e) => onSingular(e.target.value)} placeholder="Company" className={inputCls} /></Labeled></div>
          <div className="flex-1"><Labeled label="Plural name"><input value={plural} onChange={(e) => setPlural(e.target.value)} placeholder="Companies" className={inputCls} /></Labeled></div>
        </div>
        <Labeled label="API key" hint="Lowercase, used in the API and URLs. Can’t change after creation.">
          <input value={key} disabled={mode === 'edit'} onChange={(e) => { setKeyEdited(true); setKey(slugify(e.target.value)); }} placeholder="companies" className={`${inputCls} font-mono disabled:opacity-60`} />
        </Labeled>
        <Labeled label="Description"><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What does this object represent?" className={`${inputCls} h-auto resize-y py-2`} /></Labeled>
      </div>
    </Modal>
  );
}

/* ── Attribute create/edit ──────────────────────────────────────────────────── */
function AttributeModal({ mode, objectId, objectName, attr, objects, existingKeys, onClose, onSaved, onError }: {
  mode: 'create' | 'edit'; objectId: string; objectName: string; attr?: CrmAttribute; objects: CrmObject[]; existingKeys: string[];
  onClose: () => void; onSaved: () => void; onError: (m: string) => void;
}) {
  const [name, setName] = useState(attr?.name ?? '');
  const [key, setKey] = useState(attr?.key ?? '');
  const [keyEdited, setKeyEdited] = useState(mode === 'edit');
  const [type, setType] = useState<CrmAttributeType>(attr?.type ?? 'TEXT');
  const [isRequired, setIsRequired] = useState<boolean>((attr as { isRequired?: boolean })?.isRequired ?? false);
  const [isUnique, setIsUnique] = useState<boolean>((attr as { isUnique?: boolean })?.isUnique ?? false);
  const [busy, setBusy] = useState(false);

  const [options, setOptions] = useState<Array<{ id?: string; value: string; label: string }>>(
    (attr?.options ?? []).map((o) => ({ id: o.id, value: o.value ?? o.key, label: o.label ?? o.name ?? o.value ?? '' })),
  );
  const [newOpt, setNewOpt] = useState('');

  const [targetKey, setTargetKey] = useState<string>(relTarget(attr ?? ({} as CrmAttribute)) ?? objects.find((o) => o.id !== objectId)?.key ?? '');

  const [aiEnabled, setAiEnabled] = useState<boolean>(attr?.aiEnabled ?? false);
  const [aiType, setAiType] = useState<string>(attr?.aiType ?? 'RESEARCH');
  const [aiPrompt, setAiPrompt] = useState<string>(attr?.aiPrompt ?? '');

  const isSelect = type === 'SELECT' || type === 'MULTI_SELECT';
  const isRel = type === 'RELATIONSHIP';
  const keyClash = mode === 'create' && existingKeys.includes(key);

  function onName(v: string) {
    setName(v);
    if (!keyEdited) setKey(slugify(v));
  }

  async function addOptionLive() {
    const label = newOpt.trim();
    if (!label) return;
    const value = slugify(label) || `opt_${options.length + 1}`;
    if (mode === 'edit' && attr) {
      try {
        const created = await createAttributeOption(objectId, attr.id, { value, label });
        setOptions((o) => [...o, { id: created.id, value, label }]);
      } catch (e) { onError(errMsg(e)); }
    } else {
      setOptions((o) => [...o, { value, label }]);
    }
    setNewOpt('');
  }
  async function removeOption(idx: number) {
    const o = options[idx];
    if (mode === 'edit' && attr && o.id) {
      try { await archiveAttributeOption(objectId, attr.id, o.id); } catch (e) { onError(errMsg(e)); return; }
    }
    setOptions((arr) => arr.filter((_, i) => i !== idx));
  }

  async function save() {
    if (!name.trim()) return;
    if (keyClash) { onError('A field with this key already exists'); return; }
    setBusy(true);
    try {
      if (mode === 'create') {
        await createAttribute(objectId, {
          key: key || slugify(name),
          name,
          type,
          isRequired,
          isUnique,
          ...(isSelect && options.length ? { options: options.map((o, i) => ({ value: o.value, label: o.label, order: i })) } : {}),
          ...(isRel && targetKey ? { relationship: { targetObjectKey: targetKey, cardinality: 'MANY_TO_MANY', isBidirectional: true } } : {}),
          ...(aiEnabled ? { aiEnabled: true, aiType: aiType as 'CLASSIFY' | 'SUMMARIZE' | 'RESEARCH' | 'PROMPT', aiPrompt: aiPrompt || null } : {}),
        });
      } else if (attr) {
        await updateAttribute(objectId, attr.id, {
          name,
          isRequired,
          isUnique,
          ...(aiEnabled
            ? { aiEnabled: true, aiType: aiType as 'CLASSIFY' | 'SUMMARIZE' | 'RESEARCH' | 'PROMPT', aiPrompt: aiPrompt || null }
            : { aiEnabled: false }),
        });
      }
      onSaved();
    } catch (e) { onError(errMsg(e)); } finally { setBusy(false); }
  }

  const grouped = useMemo(() => {
    const g: Record<string, CrmAttributeType[]> = {};
    for (const t of ATTR_ORDER) { (g[ATTR_TYPES[t].group] ??= []).push(t); }
    return g;
  }, []);

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={mode === 'create' ? `Add field to ${objectName}` : `Edit field “${attr?.name}”`}
      icon={<Plus size={14} />}
      footer={
        <>
          <button type="button" onClick={onClose} className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3.5 text-[12.5px] font-medium text-ink-muted hover:bg-surface-2">Cancel</button>
          <button type="button" onClick={save} disabled={busy || !name.trim() || keyClash} className="brand-gradient inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[12.5px] font-semibold text-white shadow-brand disabled:opacity-60">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}{mode === 'create' ? 'Add field' : 'Save'}
          </button>
        </>
      }
    >
      <div className="space-y-3.5">
        <div className="flex gap-3">
          <div className="flex-1"><Labeled label="Field name"><input value={name} onChange={(e) => onName(e.target.value)} placeholder="Annual revenue" className={inputCls} /></Labeled></div>
          <div className="flex-1">
            <Labeled label="API key" hint={keyClash ? '⚠ key already used' : undefined}>
              <input value={key} disabled={mode === 'edit'} onChange={(e) => { setKeyEdited(true); setKey(slugify(e.target.value)); }} placeholder="annual_revenue" className={`${inputCls} font-mono disabled:opacity-60 ${keyClash ? 'border-rose-300' : ''}`} />
            </Labeled>
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-subtle">Type</label>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-subtle">Selected <TypeBadge type={type} /></span>
          </div>
          {mode === 'edit' ? (
            <p className="text-[11px] text-ink-subtle">Type can’t be changed after creation</p>
          ) : (
            <div className="max-h-[180px] space-y-2 overflow-y-auto rounded-lg border border-line bg-surface-2/30 p-2">
              {Object.entries(grouped).map(([group, types]) => (
                <div key={group}>
                  <p className="px-1 pb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-subtle">{group}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {types.map((t) => {
                      const active = t === type;
                      return (
                        <button key={t} type="button" onClick={() => setType(t)} className={['flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors', active ? 'border-brand-300 bg-brand-50' : 'border-line bg-surface hover:bg-surface-2'].join(' ')}>
                          <span className={active ? 'text-brand-600' : 'text-ink-subtle'}>{ATTR_TYPES[t].icon}</span>
                          <span className="min-w-0"><span className="block truncate text-[12.5px] font-semibold text-ink">{ATTR_TYPES[t].label}</span></span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {isSelect && (
          <Labeled label="Options">
            <div className="space-y-1.5">
              {options.map((o, i) => (
                <div key={o.id ?? i} className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5">
                  <span className="flex-1 truncate text-[12.5px] text-ink">{o.label}</span>
                  <code className="text-[11px] font-mono text-ink-subtle">{o.value}</code>
                  <button type="button" onClick={() => removeOption(i)} className="text-ink-subtle hover:text-rose-600"><X size={13} /></button>
                </div>
              ))}
              <div className="flex gap-2">
                <input value={newOpt} onChange={(e) => setNewOpt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addOptionLive(); } }} placeholder="Add an option…" className={inputCls} />
                <button type="button" onClick={() => void addOptionLive()} className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-3 text-[12.5px] font-semibold text-brand-700 hover:bg-brand-100"><Plus size={13} /> Add</button>
              </div>
            </div>
          </Labeled>
        )}

        {isRel && (
          <Labeled label="Links to" hint={mode === 'edit' ? 'Relationship target can’t be changed after creation' : 'Records of this object will link to the chosen object'}>
            <select value={targetKey} disabled={mode === 'edit'} onChange={(e) => setTargetKey(e.target.value)} className={`${inputCls} disabled:opacity-60`}>
              {objects.map((o) => <option key={o.id} value={o.key}>{o.pluralName}</option>)}
            </select>
          </Labeled>
        )}

        <div className="flex flex-wrap gap-2">
          <Toggle label="Required" on={isRequired} onClick={() => setIsRequired((v) => !v)} />
          {!isSelect && !isRel && <Toggle label="Unique" on={isUnique} onClick={() => setIsUnique((v) => !v)} />}
        </div>

        <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-3">
          <button type="button" onClick={() => setAiEnabled((v) => !v)} className="flex w-full items-center gap-2">
            <span className={['flex h-5 w-9 items-center rounded-full p-0.5 transition-colors', aiEnabled ? 'bg-brand-600' : 'bg-line'].join(' ')}><span className={['h-4 w-4 rounded-full bg-white shadow transition-transform', aiEnabled ? 'translate-x-4' : ''].join(' ')} /></span>
            <Sparkles size={14} className="text-brand-600" />
            <span className="text-[13px] font-semibold text-ink">AI-filled field</span>
            <span className="ml-auto text-[11px] text-ink-subtle">agent fills this value</span>
          </button>
          {aiEnabled && (
            <div className="mt-3 space-y-2.5">
              <div className="grid grid-cols-2 gap-1.5">
                {AI_TYPES.map((t) => (
                  <button key={t.value} type="button" onClick={() => setAiType(t.value)} className={['rounded-lg border px-2.5 py-1.5 text-left transition-colors', aiType === t.value ? 'border-brand-300 bg-brand-50' : 'border-line bg-surface hover:bg-surface-2'].join(' ')}>
                    <span className="block text-[12.5px] font-semibold text-ink">{t.label}</span>
                    <span className="block text-[10.5px] text-ink-subtle">{t.hint}</span>
                  </button>
                ))}
              </div>
              {(aiType === 'PROMPT' || aiType === 'RESEARCH') && (
                <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} rows={2} placeholder="Instruction for the agent, e.g. “Find the company’s funding stage”" className={`${inputCls} h-auto resize-y py-2`} />
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={['inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold transition-colors', on ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-line bg-surface text-ink-muted hover:bg-surface-2'].join(' ')}>
      <span className={['flex h-4 w-7 items-center rounded-full p-0.5 transition-colors', on ? 'bg-brand-600' : 'bg-line'].join(' ')}><span className={['h-3 w-3 rounded-full bg-white transition-transform', on ? 'translate-x-3' : ''].join(' ')} /></span>
      {label}
    </button>
  );
}
