'use client';

/**
 * CreateObjectModal — модалка создания кастомного объекта CRM.
 * Сценарий S001: Settings → Objects → + Create custom object.
 *
 * Поля: singular name, plural name, key (автогенерация + ручное), icon (emoji picker),
 * description, record-text attribute (имя первичного атрибута).
 *
 * После создания вызывает onCreated(object).
 */

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { createObject, createAttribute, type CrmObject } from '@/lib/crmApi';

// ──────────────────────────────────────────────
// Константы
// ──────────────────────────────────────────────

/** Зарезервированные ключи (системные объекты) */
const RESERVED_KEYS = ['companies', 'people', 'deals', 'workspaces', 'users'];

/** Быстрый набор иконок (emoji). В проде можно заменить на полноценный picker. */
const ICON_PRESETS = [
  '📋', '📁', '🏷️', '💼', '📦', '🏢', '📊', '🗂️',
  '📝', '💡', '🔑', '⚙️', '🎯', '📌', '🚀', '🌐',
  '💰', '📞', '🤝', '📈',
];

// ──────────────────────────────────────────────
// Хелперы
// ──────────────────────────────────────────────

/** Slug из строки: строчные, a-z0-9_, начинается с буквы */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/^[^a-z]+/, '')
    .slice(0, 64);
}

// ──────────────────────────────────────────────
// Типы
// ──────────────────────────────────────────────

interface CreateObjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (object: CrmObject) => void;
}

// ──────────────────────────────────────────────
// Компонент
// ──────────────────────────────────────────────

export default function CreateObjectModal({
  isOpen,
  onClose,
  onCreated,
}: CreateObjectModalProps) {
  // Поля формы
  const [singularName, setSingularName] = useState('');
  const [pluralName, setPluralName] = useState('');
  const [keyValue, setKeyValue] = useState('');
  const [keyManual, setKeyManual] = useState(false);
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('');
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [recordTextName, setRecordTextName] = useState('Name');

  // UI
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState<'basic' | 'record-text'>('basic');

  const singularRef = useRef<HTMLInputElement>(null);
  const iconPickerRef = useRef<HTMLDivElement>(null);

  // Сброс при открытии
  useEffect(() => {
    if (isOpen) {
      setSingularName('');
      setPluralName('');
      setKeyValue('');
      setKeyManual(false);
      setDescription('');
      setIcon('');
      setRecordTextName('Name');
      setErrors({});
      setLoading(false);
      setStep('basic');
      setTimeout(() => singularRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Автогенерация key из plural name
  useEffect(() => {
    if (!keyManual) {
      setKeyValue(slugify(pluralName));
    }
  }, [pluralName, keyManual]);

  // Закрытие icon picker по клику снаружи
  useEffect(() => {
    if (!iconPickerOpen) return;
    function handle(e: MouseEvent) {
      if (iconPickerRef.current && !iconPickerRef.current.contains(e.target as Node)) {
        setIconPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [iconPickerOpen]);

  // ── Валидация ──────────────────────────────────

  function validateBasic(): boolean {
    const errs: Record<string, string> = {};

    if (!singularName.trim()) errs.singularName = 'Singular name is required';
    if (!pluralName.trim()) errs.pluralName = 'Plural name is required';
    if (!keyValue) errs.key = 'Key is required';
    if (!/^[a-z][a-z0-9_-]*$/.test(keyValue)) {
      errs.key = 'Key: lowercase letters, digits, _ or -, starts with a letter';
    }
    if (RESERVED_KEYS.includes(keyValue)) {
      errs.key = `Ключ «${keyValue}» is reserved by the system`;
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateRecordText(): boolean {
    const errs: Record<string, string> = {};
    if (!recordTextName.trim()) errs.recordTextName = 'Attribute name is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Навигация шагов ───────────────────────────

  function handleNext() {
    if (!validateBasic()) return;
    setStep('record-text');
  }

  function handleBack() {
    setStep('basic');
    setErrors({});
  }

  // ── Сабмит ────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (step === 'basic') {
      handleNext();
      return;
    }

    if (!validateRecordText()) return;

    setLoading(true);
    setErrors({});

    try {
      // 1. Создаём объект
      const createdObj = await createObject({
        key: keyValue,
        singularName: singularName.trim(),
        pluralName: pluralName.trim(),
        description: description.trim() || undefined,
        icon: icon || undefined,
      });

      // 2. Создаём первичный текстовый атрибут (record title)
      const attrName = recordTextName.trim() || 'Name';
      const attrKey = attrName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^[^a-z]+/, '').replace(/_+$/, '') || 'name';
      await createAttribute(createdObj.id, {
        key: attrKey,
        name: attrName,
        type: 'TEXT',
        isRequired: true,
        isPrimary: true,
        order: 0,
      });

      onCreated?.(createdObj as unknown as CrmObject);
      onClose();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Could not create the object';

      if (status === 409) {
        setErrors({ key: `An object with key «${keyValue}» already exists` });
        setStep('basic');
      } else {
        setErrors({ _global: msg });
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Footer кнопки ─────────────────────────────

  const footer =
    step === 'basic' ? (
      <>
        <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" onClick={handleNext}>
          Next
        </Button>
      </>
    ) : (
      <>
        <Button variant="ghost" size="sm" onClick={handleBack} disabled={loading}>
          Back
        </Button>
        <Button
          variant="primary"
          size="sm"
          loading={loading}
          onClick={handleSubmit}
        >
          Create object
        </Button>
      </>
    );

  // ── Render ─────────────────────────────────────

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create custom object"
      size="md"
      footer={footer}
    >
      <form onSubmit={handleSubmit} noValidate className="px-4 py-4">
        {/* Глобальная ошибка */}
        {errors._global && (
          <div className="mb-4 rounded-md bg-[var(--danger-soft)] border border-[var(--danger)] px-3 py-2 text-[13px] text-[var(--danger)]">
            {errors._global}
          </div>
        )}

        {/* ────── ШАГ 1: Basic ────── */}
        {step === 'basic' && (
          <div className="space-y-4">
            {/* Icon picker */}
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-medium text-[var(--text-muted)] leading-4">
                Icon <span className="font-normal text-[var(--text-subtle)]">(optional)</span>
              </label>
              <div className="relative" ref={iconPickerRef}>
                <button
                  type="button"
                  onClick={() => setIconPickerOpen((v) => !v)}
                  className={clsx(
                    'h-10 w-10 rounded-xl border flex items-center justify-center text-2xl',
                    'transition-colors duration-100',
                    'hover:bg-[var(--surface-2)]',
                    iconPickerOpen
                      ? 'border-[var(--brand)] ring-2 ring-[var(--brand-soft)]'
                      : 'border-[var(--border-strong)] bg-white',
                  )}
                  title="Choose an icon"
                >
                  {icon || (
                    <span className="text-[var(--text-subtle)] text-base">📋</span>
                  )}
                </button>

                {iconPickerOpen && (
                  <div className="absolute left-0 top-[calc(100%+4px)] z-50 p-2 bg-white rounded-xl border border-[var(--border)] shadow-lg grid grid-cols-5 gap-1">
                    {ICON_PRESETS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          setIcon(emoji);
                          setIconPickerOpen(false);
                        }}
                        className={clsx(
                          'h-8 w-8 rounded-lg text-xl flex items-center justify-center',
                          'hover:bg-[var(--surface-2)] transition-colors',
                          icon === emoji && 'bg-[var(--brand-soft)] ring-2 ring-[var(--brand)]',
                        )}
                      >
                        {emoji}
                      </button>
                    ))}
                    {icon && (
                      <button
                        type="button"
                        onClick={() => {
                          setIcon('');
                          setIconPickerOpen(false);
                        }}
                        className="col-span-5 mt-1 text-[12px] text-[var(--danger)] hover:underline py-1"
                      >
                        Убрать иконку
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Singular name */}
            <Input
              ref={singularRef}
              label="Singular name"
              placeholder="e.g. Invoice"
              value={singularName}
              onChange={(e) => setSingularName(e.target.value)}
              error={errors.singularName}
              hint="Used in singular: “Create Invoice”"
            />

            {/* Plural name */}
            <Input
              label="Plural name"
              placeholder="e.g. Invoices"
              value={pluralName}
              onChange={(e) => setPluralName(e.target.value)}
              error={errors.pluralName}
              hint="Shown in menus and headers: “All Invoices”"
            />

            {/* Key */}
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-medium text-[var(--text-muted)] leading-4">
                Key / API name
              </label>
              <div className="flex items-center gap-2">
                <input
                  value={keyValue}
                  onChange={(e) => {
                    setKeyManual(true);
                    setKeyValue(e.target.value);
                  }}
                  placeholder="invoices"
                  className={clsx(
                    'block flex-1 h-8 px-2.5 rounded-md bg-white text-[13px] text-[var(--text)] font-mono',
                    'border transition-colors duration-100',
                    'placeholder:text-[var(--text-subtle)]',
                    'focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]',
                    errors.key
                      ? 'border-[var(--danger)]'
                      : 'border-[var(--border-strong)]',
                  )}
                />
                {keyManual && (
                  <button
                    type="button"
                    onClick={() => {
                      setKeyManual(false);
                      setKeyValue(slugify(pluralName));
                    }}
                    className="text-[12px] text-[var(--text-subtle)] hover:text-[var(--text)] underline whitespace-nowrap"
                  >
                    Авто
                  </button>
                )}
              </div>
              {errors.key && (
                <p className="text-[12px] text-[var(--danger)] leading-4">{errors.key}</p>
              )}
              <p className="text-[11px] text-[var(--text-subtle)]">
                Используется в URL и API. Нельзя изменить после создания.
              </p>
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-medium text-[var(--text-muted)] leading-4">
                Description{' '}
                <span className="font-normal text-[var(--text-subtle)]">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short object description…"
                rows={2}
                className={clsx(
                  'block w-full rounded-md bg-white text-[13px] text-[var(--text)] px-2.5 py-1.5 resize-none',
                  'border border-[var(--border-strong)]',
                  'placeholder:text-[var(--text-subtle)]',
                  'transition-colors duration-100',
                  'focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]',
                )}
              />
            </div>
          </div>
        )}

        {/* ────── ШАГ 2: Record text ────── */}
        {step === 'record-text' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
              <p className="text-[13px] font-medium text-[var(--text)] mb-1">
                Создаётся объект:{' '}
                <span className="font-semibold">
                  {icon} {pluralName}
                </span>
              </p>
              <p className="text-[12px] text-[var(--text-subtle)]">
                API key: <code className="font-mono">{keyValue}</code>
              </p>
            </div>

            <div>
              <p className="text-[13px] font-semibold text-[var(--text)] mb-1">
                Record text attribute
              </p>
              <p className="text-[12px] text-[var(--text-subtle)] mb-3">
                Выберите имя текстового атрибута, который будет отображаться как
                «имя записи» — в таблицах, поиске и связанных объектах.
              </p>

              <Input
                label="Primary text attribute name"
                placeholder="Name"
                value={recordTextName}
                onChange={(e) => setRecordTextName(e.target.value)}
                error={errors.recordTextName}
                hint="e.g. “Invoice Name”, “Name”, “Title”"
              />
            </div>

            <div className="rounded-lg border border-[var(--border)] bg-white px-3 py-2.5">
              <p className="text-[12px] text-[var(--text-subtle)]">
                <span className="font-medium text-[var(--text)]">Preview: </span>
                Записи будут показаны как{' '}
                <span className="font-medium">“{recordTextName || 'Name'}”</span> instead of
                числового ID.
              </p>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
