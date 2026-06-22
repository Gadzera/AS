'use client';

/**
 * Settings → Data → Objects → [objectKey]
 * Сценарии S002 (конфиг объекта), S003 (переименование), S032 (архив атрибута),
 * S029/S030/S031 (required/unique/reorder атрибутов).
 *
 * URL: /crm/settings/data/objects/:objectKey
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronRight,
  Grip,
  Plus,
  Archive,
  Pencil,
  Check,
  X as XIcon,
} from 'lucide-react';
import {
  getObject,
  updateObject,
  updateAttribute,
  archiveAttribute,
  type CrmObjectDetail,
  type CrmAttributeFull,
} from '@/lib/crmApi';
import Button from '@/components/ui/Button';
import CreateAttributeModal from '@/components/crm/CreateAttributeModal';

type Tab = 'attributes' | 'configuration' | 'appearance';

const ATTR_TYPE_LABELS: Record<string, string> = {
  TEXT: 'Text',
  LONG_TEXT: 'Long text',
  NUMBER: 'Number',
  CURRENCY: 'Currency',
  DATE: 'Date',
  DATETIME: 'Date & time',
  BOOLEAN: 'Checkbox',
  SELECT: 'Select',
  MULTI_SELECT: 'Multi-select',
  RELATIONSHIP: 'Relationship',
  URL: 'URL',
  EMAIL: 'Email',
  PHONE: 'Phone',
  USER: 'User',
  JSON: 'JSON',
  LOCATION: 'Location',
};

export default function ObjectSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const objectKey = params.objectKey as string;

  const [obj, setObj] = useState<CrmObjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('attributes');

  // Создание атрибута
  const [createAttrOpen, setCreateAttrOpen] = useState(false);
  // Редактирование атрибута (имя + AI-конфиг, вкл. opt-out auto-rerun — M25-2)
  const [editAttr, setEditAttr] = useState<CrmAttributeFull | null>(null);

  // Редактирование имени объекта
  const [editingName, setEditingName] = useState(false);
  const [singularDraft, setSingularDraft] = useState('');
  const [pluralDraft, setPluralDraft] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Архивирование атрибута
  const [archivingAttr, setArchivingAttr] = useState<string | null>(null);

  // Inline toggle required/unique
  const [togglingAttr, setTogglingAttr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await getObject(objectKey);
      setObj(data);
    } catch {
      router.replace('/crm/settings/data/objects');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectKey]);

  // ── Rename object ─────────────────────────────
  function startEditName() {
    if (!obj) return;
    setSingularDraft(obj.singularName);
    setPluralDraft(obj.pluralName);
    setEditingName(true);
  }

  async function saveEditName() {
    if (!obj) return;
    setSavingName(true);
    try {
      await updateObject(obj.id, {
        singularName: singularDraft.trim() || obj.singularName,
        pluralName: pluralDraft.trim() || obj.pluralName,
      });
      await load();
      setEditingName(false);
    } catch {
      alert('Не удалось переименовать объект');
    } finally {
      setSavingName(false);
    }
  }

  // ── Toggle required/unique ────────────────────
  async function toggleAttrFlag(attr: CrmAttributeFull, flag: 'isRequired' | 'isUnique') {
    if (!obj) return;
    setTogglingAttr(attr.id);
    try {
      await updateAttribute(obj.id, attr.id, { [flag]: !attr[flag] });
      await load();
    } catch {
      alert(`Не удалось изменить ${flag}`);
    } finally {
      setTogglingAttr(null);
    }
  }

  // ── Archive attribute ─────────────────────────
  async function handleArchiveAttr(attr: CrmAttributeFull) {
    if (!obj) return;
    if (attr.isSystem) {
      alert('Системные атрибуты нельзя архивировать');
      return;
    }
    if (attr.isPrimary) {
      alert('Нельзя архивировать первичный атрибут (title)');
      return;
    }
    if (!confirm(`Архивировать атрибут «${attr.name}»?`)) return;
    setArchivingAttr(attr.id);
    try {
      await archiveAttribute(obj.id, attr.id);
      await load();
    } catch {
      alert('Не удалось архивировать атрибут');
    } finally {
      setArchivingAttr(null);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-[13px] text-gray-500">
        Загрузка…
      </div>
    );
  }

  if (!obj) return null;

  const attrs = (obj.attributes as CrmAttributeFull[]) ?? [];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white text-gray-900">
      {/* Шапка */}
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-gray-200 px-6">
        <div className="flex items-center gap-2 text-[13px] text-gray-500">
          <Link href="/crm/settings/data/objects" className="hover:text-gray-900">
            Objects
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                value={pluralDraft}
                onChange={(e) => setPluralDraft(e.target.value)}
                className="h-7 rounded-md border border-gray-300 px-2 text-[13px] font-medium text-gray-900 focus:border-blue-500 focus:outline-none"
                placeholder="Plural name"
              />
              <button
                type="button"
                disabled={savingName}
                onClick={saveEditName}
                className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setEditingName(false)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className="font-medium text-gray-900">{obj.pluralName}</span>
              <button
                type="button"
                onClick={startEditName}
                className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="rounded-full border border-gray-200 px-2 py-0.5 text-[11px] text-gray-500">
            key: <code className="font-mono">{obj.key}</code>
          </span>
          {obj.isSystem && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
              System
            </span>
          )}
        </div>
      </div>

      {/* Табы */}
      <div className="flex shrink-0 gap-1 border-b border-gray-200 px-6">
        {(['attributes', 'configuration', 'appearance'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={[
              'relative h-10 px-3 text-[13px] capitalize transition-colors',
              tab === t
                ? 'font-medium text-gray-900 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-gray-900'
                : 'text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Содержимое */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* ────── Attributes tab ────── */}
        {tab === 'attributes' && (
          <div className="max-w-2xl">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-[13px] text-gray-500">
                {attrs.length} attribute{attrs.length !== 1 ? 's' : ''}
              </p>
              <Button size="sm" variant="secondary" onClick={() => setCreateAttrOpen(true)}>
                <Plus className="mr-1 h-4 w-4" />
                Add attribute
              </Button>
            </div>

            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
              {attrs.map((attr) => (
                <li
                  key={attr.id}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50"
                >
                  <Grip className="h-4 w-4 shrink-0 cursor-grab text-gray-300" />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-gray-900">{attr.name}</span>
                      {attr.isPrimary && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                          Title
                        </span>
                      )}
                      {attr.isSystem && (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                          System
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400">
                      {ATTR_TYPE_LABELS[attr.type] ?? attr.type}
                      <span className="mx-1.5 text-gray-300">&bull;</span>
                      <code className="font-mono">{attr.key}</code>
                    </p>
                  </div>

                  {/* Required toggle */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={togglingAttr === attr.id || !!attr.isSystem}
                      onClick={() => toggleAttrFlag(attr, 'isRequired')}
                      title={attr.isRequired ? 'Required (click to disable)' : 'Not required (click to enable)'}
                      className={[
                        'h-6 rounded-full px-2 text-[11px] font-medium transition-colors',
                        'disabled:cursor-not-allowed disabled:opacity-40',
                        attr.isRequired
                          ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200',
                      ].join(' ')}
                    >
                      Required
                    </button>

                    <button
                      type="button"
                      disabled={togglingAttr === attr.id || !!attr.isSystem}
                      onClick={() => toggleAttrFlag(attr, 'isUnique')}
                      title={attr.isUnique ? 'Unique (click to disable)' : 'Not unique (click to enable)'}
                      className={[
                        'h-6 rounded-full px-2 text-[11px] font-medium transition-colors',
                        'disabled:cursor-not-allowed disabled:opacity-40',
                        attr.isUnique
                          ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200',
                      ].join(' ')}
                    >
                      Unique
                    </button>
                  </div>

                  {/* Edit button (имя + AI-конфиг, вкл. opt-out auto-rerun) */}
                  <button
                    type="button"
                    disabled={!!attr.isSystem}
                    onClick={() => setEditAttr(attr)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-gray-300 hover:bg-brand-50 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-30"
                    title={attr.aiEnabled ? 'Edit field & AI config' : 'Edit field'}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>

                  {/* Archive button */}
                  <button
                    type="button"
                    disabled={!!attr.isSystem || !!attr.isPrimary || archivingAttr === attr.id}
                    onClick={() => handleArchiveAttr(attr)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-gray-300 hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
                    title="Архивировать атрибут"
                  >
                    <Archive className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ────── Configuration tab ────── */}
        {tab === 'configuration' && (
          <div className="max-w-lg space-y-6">
            <section>
              <h3 className="mb-4 text-[13px] font-semibold text-gray-900">Object names</h3>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-gray-500">
                    Singular name
                  </label>
                  <input
                    defaultValue={obj.singularName}
                    onBlur={async (e) => {
                      const v = e.target.value.trim();
                      if (v && v !== obj.singularName) {
                        try {
                          await updateObject(obj.id, { singularName: v });
                          await load();
                        } catch {
                          e.target.value = obj.singularName;
                        }
                      }
                    }}
                    className="h-8 w-full rounded-md border border-gray-300 px-2.5 text-[13px] text-gray-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-gray-500">
                    Plural name
                  </label>
                  <input
                    defaultValue={obj.pluralName}
                    onBlur={async (e) => {
                      const v = e.target.value.trim();
                      if (v && v !== obj.pluralName) {
                        try {
                          await updateObject(obj.id, { pluralName: v });
                          await load();
                        } catch {
                          e.target.value = obj.pluralName;
                        }
                      }
                    }}
                    className="h-8 w-full rounded-md border border-gray-300 px-2.5 text-[13px] text-gray-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-gray-500">
                    Description
                  </label>
                  <textarea
                    defaultValue={obj.description ?? ''}
                    rows={3}
                    onBlur={async (e) => {
                      const v = e.target.value.trim();
                      if (v !== (obj.description ?? '')) {
                        try {
                          await updateObject(obj.id, { description: v || null });
                          await load();
                        } catch {
                          e.target.value = obj.description ?? '';
                        }
                      }
                    }}
                    className="w-full resize-none rounded-md border border-gray-300 px-2.5 py-1.5 text-[13px] text-gray-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-[13px] font-semibold text-gray-900">API key</h3>
              <p className="text-[13px] text-gray-500">
                <code className="rounded bg-gray-100 px-2 py-0.5 font-mono text-gray-800">
                  {obj.key}
                </code>
              </p>
              <p className="mt-1 text-[12px] text-gray-400">Key cannot be changed after creation.</p>
            </section>
          </div>
        )}

        {/* ────── Appearance tab ────── */}
        {tab === 'appearance' && (
          <div className="max-w-lg space-y-6">
            <section>
              <h3 className="mb-4 text-[13px] font-semibold text-gray-900">Icon & color</h3>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-gray-500">Icon (emoji)</label>
                  <input
                    defaultValue={obj.icon ?? ''}
                    maxLength={4}
                    onBlur={async (e) => {
                      const v = e.target.value.trim();
                      if (v !== (obj.icon ?? '')) {
                        try {
                          await updateObject(obj.id, { icon: v || null });
                          await load();
                        } catch {
                          e.target.value = obj.icon ?? '';
                        }
                      }
                    }}
                    placeholder="e.g. 📋"
                    className="h-9 w-24 rounded-md border border-gray-300 px-2 text-center text-2xl focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-gray-500">Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      defaultValue={obj.color ?? '#6366f1'}
                      onBlur={async (e) => {
                        const v = e.target.value;
                        if (v !== (obj.color ?? '')) {
                          try {
                            await updateObject(obj.id, { color: v });
                            await load();
                          } catch {}
                        }
                      }}
                      className="h-9 w-14 cursor-pointer rounded-md border border-gray-300"
                    />
                    <span className="text-[12px] text-gray-400">
                      Used for object badge and sidebar indicator.
                    </span>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Модалка создания атрибута */}
      {obj && (
        <CreateAttributeModal
          isOpen={createAttrOpen}
          onClose={() => setCreateAttrOpen(false)}
          objectId={obj.id}
          existingAttributes={(obj.attributes ?? []).map((a) => ({ key: a.key, name: a.name, aiEnabled: a.aiEnabled }))}
          onCreated={() => {
            setCreateAttrOpen(false);
            load();
          }}
        />
      )}

      {/* Модалка редактирования атрибута (имя + AI-конфиг + opt-out auto-rerun — M25-2) */}
      {obj && editAttr && (
        <CreateAttributeModal
          isOpen={!!editAttr}
          onClose={() => setEditAttr(null)}
          objectId={obj.id}
          existingAttributes={(obj.attributes ?? [])
            .filter((a) => a.id !== editAttr.id)
            .map((a) => ({ key: a.key, name: a.name, aiEnabled: a.aiEnabled }))}
          editAttribute={{
            id: editAttr.id,
            key: editAttr.key,
            name: editAttr.name,
            type: editAttr.type,
            description: editAttr.description,
            isPrimary: editAttr.isPrimary,
            aiEnabled: editAttr.aiEnabled,
            aiType: editAttr.aiType,
            aiPrompt: editAttr.aiPrompt,
            aiGuidance: editAttr.aiGuidance,
            aiConfig: editAttr.aiConfig,
          }}
          onCreated={() => {
            setEditAttr(null);
            load();
          }}
        />
      )}
    </div>
  );
}
