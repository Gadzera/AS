'use client';

/**
 * AttributeTypePicker — выпадающий список типов атрибутов CRM.
 * Отображает все базовые типы + секцию AI autofill.
 * Используется в CreateAttributeModal.
 */

import { useEffect, useRef, useState } from 'react';
import {
  AlignLeft,
  Braces,
  Calendar,
  ChevronDown,
  CheckSquare,
  Circle,
  Clock,
  CreditCard,
  Hash,
  Link2,
  List,
  MapPin,
  Phone,
  Sparkles,
  Star,
  Text,
  User,
  type LucideIcon,
} from 'lucide-react';
import clsx from 'clsx';
import type { CrmAttributeType } from '@/lib/crmApi';

// ──────────────────────────────────────────────
// Конфигурация типов
// ──────────────────────────────────────────────

interface TypeDef {
  value: CrmAttributeType;
  label: string;
  description: string;
  icon: LucideIcon;
}

/** Базовые типы из S010 */
const BASE_TYPES: TypeDef[] = [
  { value: 'TEXT',         label: 'Text',         description: 'Короткий текст',               icon: Text },
  { value: 'LONG_TEXT',    label: 'Long text',    description: 'Многострочный текст',           icon: AlignLeft },
  { value: 'NUMBER',       label: 'Number',       description: 'Числовое значение',             icon: Hash },
  { value: 'CURRENCY',     label: 'Currency',     description: 'Денежная сумма',               icon: CreditCard },
  { value: 'DATE',         label: 'Date',         description: 'Дата (без времени)',            icon: Calendar },
  { value: 'DATETIME',     label: 'Timestamp',    description: 'Дата и время',                 icon: Clock },
  { value: 'BOOLEAN',      label: 'Checkbox',     description: 'Флаг да/нет',                  icon: CheckSquare },
  { value: 'SELECT',       label: 'Select',       description: 'Один вариант из списка',        icon: Circle },
  { value: 'MULTI_SELECT', label: 'Multi-select', description: 'Несколько вариантов из списка', icon: List },
  { value: 'URL',          label: 'Record',       description: 'Ссылка на запись или URL',      icon: Link2 },
  { value: 'USER',         label: 'User',         description: 'Участник workspace',            icon: User },
  { value: 'RELATIONSHIP', label: 'Relationship', description: 'Связь с другим объектом',      icon: Braces },
  { value: 'LOCATION',     label: 'Location',     description: 'Географический адрес',          icon: MapPin },
  { value: 'PHONE',        label: 'Phone Number', description: 'Телефонный номер',             icon: Phone },
  { value: 'JSON',         label: 'Rating',       description: 'Числовой рейтинг (1–5)',        icon: Star },
  { value: 'EMAIL',        label: 'Email',        description: 'Адрес электронной почты',       icon: Text },
];

// ──────────────────────────────────────────────
// Публичный интерфейс
// ──────────────────────────────────────────────

interface AttributeTypePickerProps {
  value: CrmAttributeType | null;
  onChange: (type: CrmAttributeType) => void;
  disabled?: boolean;
  error?: string;
}

export default function AttributeTypePicker({
  value,
  onChange,
  disabled = false,
  error,
}: AttributeTypePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Закрываем дропдаун при клике снаружи
  useEffect(() => {
    if (!open) return;

    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  // Закрываем по Esc
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  const selected = BASE_TYPES.find((t) => t.value === value) ?? null;
  const SelectedIcon = selected?.icon ?? Circle;

  function handleSelect(type: CrmAttributeType) {
    onChange(type);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1">
      <label className="text-[12px] font-medium text-[var(--text-muted)] leading-4">
        Attribute Type
      </label>

      {/* Кнопка-триггер */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={clsx(
          'flex h-8 w-full items-center justify-between gap-2 rounded-md px-2.5',
          'bg-white border text-[13.5px] text-left text-[var(--text)]',
          'transition-colors duration-100',
          'focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]',
          error
            ? 'border-[var(--danger)]'
            : 'border-[var(--border-strong)]',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        <span className="flex items-center gap-2">
          <SelectedIcon size={14} className="shrink-0 text-[var(--text-subtle)]" />
          <span className={value ? 'text-[var(--text)]' : 'text-[var(--text-subtle)]'}>
            {selected?.label ?? 'Выберите тип…'}
          </span>
        </span>
        <ChevronDown
          size={14}
          className={clsx(
            'shrink-0 text-[var(--text-subtle)] transition-transform duration-150',
            open && 'rotate-180',
          )}
        />
      </button>

      {error && (
        <p className="text-[12px] text-[var(--danger)] leading-4">{error}</p>
      )}

      {/* Выпадающий список */}
      {open && (
        <div
          role="listbox"
          className={clsx(
            'absolute left-0 top-[calc(100%+4px)] z-50 w-full min-w-[220px]',
            'rounded-xl border border-[var(--border)] bg-white shadow-lg',
            'overflow-hidden',
          )}
          style={{ boxShadow: 'var(--shadow-lg)' }}
        >
          {/* Секция AI (плейсхолдер) */}
          <div className="px-3 py-2 border-b border-[var(--border)]">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-subtle)] mb-1">
              AI autofill
            </p>
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-colors"
              onClick={() => {
                /* AI autofill — будущая интеграция */
                setOpen(false);
              }}
            >
              <Sparkles size={14} className="shrink-0 text-purple-500" />
              <span>AI autofill</span>
              <span className="ml-auto text-[11px] text-[var(--text-subtle)] bg-purple-50 border border-purple-200 rounded px-1.5">
                Beta
              </span>
            </button>
          </div>

          {/* Базовые типы */}
          <div className="px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-subtle)] mb-1">
              Basic types
            </p>
            <ul className="space-y-0.5 max-h-[280px] overflow-y-auto">
              {BASE_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = value === type.value;

                return (
                  <li key={type.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelect(type.value)}
                      className={clsx(
                        'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] transition-colors',
                        isSelected
                          ? 'bg-[var(--brand-soft)] text-[var(--brand)]'
                          : 'text-[var(--text)] hover:bg-[var(--surface-2)]',
                      )}
                    >
                      <Icon
                        size={14}
                        className={clsx(
                          'shrink-0',
                          isSelected ? 'text-[var(--brand)]' : 'text-[var(--text-subtle)]',
                        )}
                      />
                      <span className="flex-1 text-left">{type.label}</span>
                      <span className="text-[11px] text-[var(--text-subtle)]">
                        {type.description}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
