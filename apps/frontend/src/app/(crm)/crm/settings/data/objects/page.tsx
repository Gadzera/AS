'use client';

/**
 * Settings → Data → Objects
 * Сценарии S001 (список объектов + создание), S004 (архивирование).
 *
 * URL: /crm/settings/data/objects
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Archive, Settings, ChevronRight, Building2, Users, Briefcase, CircleDot } from 'lucide-react';
import {
  listObjects,
  archiveObject,
  type CrmObject,
} from '@/lib/crmApi';
import CreateObjectModal from '@/components/crm/CreateObjectModal';
import Button from '@/components/ui/Button';

function getObjectIcon(object: CrmObject) {
  const k = object.key.toLowerCase();
  if (k.includes('compan') || k.includes('building')) return Building2;
  if (k.includes('people') || k.includes('person') || k.includes('user')) return Users;
  if (k.includes('deal') || k.includes('pipeline')) return Briefcase;
  return CircleDot;
}

export default function ObjectsSettingsPage() {
  const [objects, setObjects] = useState<CrmObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [archiving, setArchiving] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await listObjects();
      setObjects(data);
    } catch {
      setObjects([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleArchive(object: CrmObject) {
    if (object.isSystem) return;
    if (!confirm(`Архивировать объект «${object.pluralName}»? Это скроет его из интерфейса.`)) return;
    setArchiving(object.id);
    try {
      await archiveObject(object.id);
      await load();
    } catch {
      alert('Не удалось архивировать объект');
    } finally {
      setArchiving(null);
    }
  }

  const systemObjects = objects.filter((o) => o.isSystem);
  const customObjects = objects.filter((o) => !o.isSystem);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white text-gray-900">
      {/* Шапка */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-gray-200 px-6">
        <div className="flex items-center gap-2 text-[13px] text-gray-500">
          <Link href="/crm" className="hover:text-gray-900">CRM</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-medium text-gray-900">Settings / Data / Objects</span>
        </div>
        <Button
          size="sm"
          variant="primary"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Create object
        </Button>
      </div>

      {/* Контент */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-3xl space-y-8">

          {/* Standard objects */}
          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Standard objects
            </h2>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-100" />
                ))}
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
                {systemObjects.map((obj) => {
                  const Icon = getObjectIcon(obj);
                  return (
                    <li key={obj.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                        {obj.icon ? (
                          <span className="text-lg leading-none">{obj.icon}</span>
                        ) : (
                          <Icon className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-gray-900">{obj.pluralName}</p>
                        <p className="text-[12px] text-gray-500">
                          key: <code className="font-mono">{obj.key}</code>
                          {obj._count?.records !== undefined && (
                            <span className="ml-2">&bull; {obj._count.records} records</span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border border-gray-200 px-2 py-0.5 text-[11px] text-gray-500">
                          System
                        </span>
                        <Link
                          href={`/crm/settings/data/objects/${obj.key}`}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                          title="Настройки"
                        >
                          <Settings className="h-4 w-4" />
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Custom objects */}
          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Custom objects
            </h2>
            {loading ? (
              <div className="h-14 animate-pulse rounded-xl bg-gray-100" />
            ) : customObjects.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-gray-200 px-6 py-10 text-center">
                <CircleDot className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                <p className="text-[13px] font-medium text-gray-700">No custom objects yet</p>
                <p className="mt-1 text-[12px] text-gray-400">
                  Create objects to model your data — Invoices, Projects, Subscriptions…
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-4"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Create custom object
                </Button>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
                {customObjects.map((obj) => {
                  const Icon = getObjectIcon(obj);
                  return (
                    <li key={obj.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                        {obj.icon ? (
                          <span className="text-lg leading-none">{obj.icon}</span>
                        ) : (
                          <Icon className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-gray-900">{obj.pluralName}</p>
                        <p className="text-[12px] text-gray-500">
                          key: <code className="font-mono">{obj.key}</code>
                          {obj._count?.records !== undefined && (
                            <span className="ml-2">&bull; {obj._count.records} records</span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/crm/settings/data/objects/${obj.key}`}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                          title="Настройки"
                        >
                          <Settings className="h-4 w-4" />
                        </Link>
                        <button
                          type="button"
                          disabled={archiving === obj.id}
                          onClick={() => handleArchive(obj)}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                          title="Архивировать"
                        >
                          <Archive className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>

      <CreateObjectModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          load();
        }}
      />
    </div>
  );
}
