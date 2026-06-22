'use client';

/**
 * CreateAttributeModal — модалка создания нового атрибута объекта CRM.
 * Сценарии S010–S034 (UI-часть).
 *
 * Вход: из + Add column (в DataTable) или из Settings → Objects → Attributes.
 * После создания вызывает onCreated(attribute).
 */

import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import clsx from 'clsx';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import AttributeTypePicker from './AttributeTypePicker';
import AiFieldEditor, { draftToPayload, aiFieldsToDraft, type AiFieldDraft } from './AiFieldEditor';
import { createAttribute, updateAttribute, type CrmAttribute, type CrmAttributeType } from '@/lib/crmApi';

/** M25-2: атрибут для режима редактирования (AI-конфиг, вкл. opt-out auto-rerun). */
export interface EditableAttribute {
  id: string;
  key: string;
  name: string;
  type: CrmAttributeType;
  description?: string | null;
  isPrimary?: boolean;
  aiEnabled?: boolean;
  aiType?: 'CLASSIFY' | 'SUMMARIZE' | 'RESEARCH' | 'PROMPT' | null;
  aiPrompt?: string | null;
  aiGuidance?: string | null;
  aiConfig?: Record<string, unknown> | null;
}

const EMPTY_AI_DRAFT: AiFieldDraft = {
  aiEnabled: false,
  aiType: null,
  aiPrompt: '',
  aiGuidance: '',
  categories: '',
  autoRerun: false,
  sourceMode: 'explicit',
  sourceAttributeKeys: [],
};

// ──────────────────────────────────────────────
// Типы
// ──────────────────────────────────────────────

interface AttributeOption {
  /** Локальный uid для key в списке */
  _uid: string;
  value: string;
  label: string;
  color: string;
}

interface CreateAttributeModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** ID объекта, в котором создаётся атрибут */
  objectId: string;
  /** Опционально: ID view для автоматической привязки колонки */
  addToViewId?: string;
  /** M25-2: существующие атрибуты объекта — кандидаты в зависимости auto-rerun */
  existingAttributes?: { key: string; name: string; aiEnabled?: boolean }[];
  /** M25-2: если задан — модалка работает в режиме редактирования (AI-конфиг + opt-out auto-rerun) */
  editAttribute?: EditableAttribute | null;
  onCreated?: (attribute: CrmAttribute) => void;
}

// ──────────────────────────────────────────────
// Хелперы
// ──────────────────────────────────────────────

/** Генерируем key из имени: snake_case, строчные, a-z0-9_ */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/^[^a-z]+/, '') // начинаем с буквы
    .slice(0, 64);
}

/** Типы, для которых показываем секцию Options */
const SELECT_TYPES: CrmAttributeType[] = ['SELECT', 'MULTI_SELECT'];

/** Типы, для которых доступен "Set as title field" */
const TITLE_ELIGIBLE_TYPES: CrmAttributeType[] = ['TEXT'];

/** Цвета опций по умолчанию */
const OPTION_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#64748b',
];

let _optionCounter = 0;
function newUid() {
  return `opt_${++_optionCounter}_${Math.random().toString(36).slice(2, 7)}`;
}

// ──────────────────────────────────────────────
// Компонент
// ──────────────────────────────────────────────

export default function CreateAttributeModal({
  isOpen,
  onClose,
  objectId,
  addToViewId,
  existingAttributes,
  editAttribute,
  onCreated,
}: CreateAttributeModalProps) {
  const isEdit = !!editAttribute;
  // Форма
  const [type, setType] = useState<CrmAttributeType | null>(null);
  const [name, setName] = useState('');
  const [keyValue, setKeyValue] = useState('');
  const [keyManual, setKeyManual] = useState(false);
  const [description, setDescription] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [aiDraft, setAiDraft] = useState<AiFieldDraft>(EMPTY_AI_DRAFT);
  const [options, setOptions] = useState<AttributeOption[]>([]);

  // UI-состояния
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const nameRef = useRef<HTMLInputElement>(null);

  // Сброс/заполнение при открытии (create → пусто; edit → seed из editAttribute)
  useEffect(() => {
    if (!isOpen) return;
    if (editAttribute) {
      // M25-2: режим редактирования — seed (тип/ключ менять нельзя)
      setType(editAttribute.type);
      setName(editAttribute.name);
      setKeyValue(editAttribute.key);
      setKeyManual(true);
      setDescription(editAttribute.description ?? '');
      setIsPrimary(!!editAttribute.isPrimary);
      setAiDraft(
        aiFieldsToDraft({
          aiEnabled: editAttribute.aiEnabled,
          aiType: editAttribute.aiType,
          aiPrompt: editAttribute.aiPrompt,
          aiGuidance: editAttribute.aiGuidance,
          aiConfig: editAttribute.aiConfig,
        }) as AiFieldDraft,
      );
      setOptions([]);
      setErrors({});
      setLoading(false);
    } else {
      setType(null);
      setName('');
      setKeyValue('');
      setKeyManual(false);
      setDescription('');
      setIsPrimary(false);
      setAiDraft(EMPTY_AI_DRAFT);
      setOptions([]);
      setErrors({});
      setLoading(false);
      // Фокус на поле Name
      setTimeout(() => nameRef.current?.focus(), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editAttribute]);

  // Автогенерация key из name
  useEffect(() => {
    if (!keyManual) {
      setKeyValue(slugify(name));
    }
  }, [name, keyManual]);

  // ── Опции (select/multi-select) ────────────────

  function addOption() {
    setOptions((prev) => [
      ...prev,
      {
        _uid: newUid(),
        value: '',
        label: '',
        color: OPTION_COLORS[prev.length % OPTION_COLORS.length],
      },
    ]);
  }

  function updateOption(uid: string, field: keyof Omit<AttributeOption, '_uid'>, val: string) {
    setOptions((prev) =>
      prev.map((o) => {
        if (o._uid !== uid) return o;
        // Синхронизируем value с label, если value не заполнен вручную
        if (field === 'label') {
          return { ...o, label: val, value: o.value || slugify(val) };
        }
        return { ...o, [field]: val };
      }),
    );
  }

  function removeOption(uid: string) {
    setOptions((prev) => prev.filter((o) => o._uid !== uid));
  }

  // ── Валидация ──────────────────────────────────

  function validate(): boolean {
    const errs: Record<string, string> = {};

    if (!type) errs.type = 'Choose an attribute type';
    if (!name.trim()) errs.name = 'Name is required';
    if (!keyValue) errs.key = 'Key is required';
    if (!/^[a-z][a-z0-9_-]*$/.test(keyValue)) {
      errs.key = 'Key: lowercase letters, digits, _ or -, starts with a letter';
    }

    if (type && SELECT_TYPES.includes(type)) {
      for (const opt of options) {
        if (!opt.label.trim()) {
          errs.options = 'Every option must have a label';
          break;
        }
      }
    }

    if (aiDraft.aiEnabled && !aiDraft.aiType) {
      errs._global = 'Choose an AI field type or turn off AI autofill';
    }

    // M25-2 (адверс MEDIUM-1): auto-rerun в режиме explicit без выбранных полей —
    // молчаливый no-op. Не даём сохранить «включённый, но мёртвый» конфиг.
    if (
      aiDraft.aiEnabled &&
      aiDraft.autoRerun &&
      aiDraft.sourceMode === 'explicit' &&
      aiDraft.sourceAttributeKeys.length === 0
    ) {
      errs._global = 'Auto-rerun needs at least one source field, or switch to "Any non-AI field".';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Сабмит ────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setErrors({});

    try {
      // M25-2: режим редактирования — обновляем имя/описание + ВЕСЬ AI-конфиг.
      // draftToPayload всегда возвращает aiEnabled/aiType/aiPrompt/aiGuidance/aiConfig,
      // поэтому выключение AI или auto-rerun корректно очищает конфиг (бэкенд перезаписывает aiConfig целиком).
      if (isEdit && editAttribute) {
        await updateAttribute(objectId, editAttribute.id, {
          name: name.trim(),
          description: description.trim() || null,
          ...draftToPayload(aiDraft),
        });
        onCreated?.({ id: editAttribute.id } as unknown as CrmAttribute);
        onClose();
        return;
      }

      const payload: Parameters<typeof createAttribute>[1] = {
        key: keyValue,
        name: name.trim(),
        type: type!,
        isPrimary: isPrimary || undefined,
        description: description.trim() || undefined,
      };

      // AI-поле (M2): если включено — пишем aiEnabled/aiType/aiPrompt/aiGuidance/aiConfig.
      if (aiDraft.aiEnabled && aiDraft.aiType) {
        Object.assign(payload, draftToPayload(aiDraft));
      }

      // Опции для select-типов
      if (type && SELECT_TYPES.includes(type) && options.length > 0) {
        payload.options = options.map((o, idx) => ({
          value: o.value || slugify(o.label),
          label: o.label,
          color: o.color,
          order: idx,
        }));
      }

      const created = await createAttribute(objectId, payload);
      onCreated?.(created as unknown as CrmAttribute);
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Could not create the attribute';
      setErrors({ _global: msg });
    } finally {
      setLoading(false);
    }
  }

  // ── Render ─────────────────────────────────────

  const showOptions = type !== null && SELECT_TYPES.includes(type);
  const showTitleToggle = type !== null && TITLE_ELIGIBLE_TYPES.includes(type);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit attribute' : 'Create attribute'}
      size="md"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={loading}
            onClick={handleSubmit}
          >
            {isEdit ? 'Save changes' : 'Create attribute'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="px-4 py-4 space-y-4">
        {/* Глобальная ошибка */}
        {errors._global && (
          <div className="rounded-md bg-[var(--danger-soft)] border border-[var(--danger)] px-3 py-2 text-[13px] text-[var(--danger)]">
            {errors._global}
          </div>
        )}

        {/* Тип (в edit-режиме не меняется) */}
        {isEdit ? (
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium text-[var(--text-muted)] leading-4">Type</label>
            <div className="inline-flex h-8 w-fit items-center rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2.5 text-[13px] font-medium text-[var(--text-muted)]">
              {type}
            </div>
            <p className="text-[11px] text-[var(--text-subtle)]">Тип нельзя изменить после создания.</p>
          </div>
        ) : (
          <AttributeTypePicker
            value={type}
            onChange={(t) => {
              setType(t);
              // Сброс title-toggle если тип не поддерживает
              if (!TITLE_ELIGIBLE_TYPES.includes(t)) setIsPrimary(false);
              // Сброс опций если тип не select
              if (!SELECT_TYPES.includes(t)) setOptions([]);
            }}
            error={errors.type}
          />
        )}

        {/* Имя */}
        <Input
          ref={nameRef}
          label="Name"
          placeholder="e.g. Business model"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />

        {/* Key */}
        <div className="flex flex-col gap-1">
          <label className="text-[12px] font-medium text-[var(--text-muted)] leading-4">
            API key
          </label>
          <div className="flex items-center gap-2">
            <input
              value={keyValue}
              readOnly={isEdit}
              disabled={isEdit}
              onChange={(e) => {
                setKeyManual(true);
                setKeyValue(e.target.value);
              }}
              placeholder="business_model"
              className={clsx(
                'block flex-1 h-8 px-2.5 rounded-md bg-white text-[13px] text-[var(--text)] font-mono',
                'border transition-colors duration-100',
                'placeholder:text-[var(--text-subtle)]',
                'focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]',
                isEdit && 'cursor-not-allowed bg-[var(--surface-2)] text-[var(--text-subtle)]',
                errors.key
                  ? 'border-[var(--danger)]'
                  : 'border-[var(--border-strong)]',
              )}
            />
            {keyManual && !isEdit && (
              <button
                type="button"
                title="Reset to auto-generated"
                onClick={() => {
                  setKeyManual(false);
                  setKeyValue(slugify(name));
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
            Используется в API и фильтрах. Нельзя изменить после создания.
          </p>
        </div>

        {/* Описание */}
        <div className="flex flex-col gap-1">
          <label className="text-[12px] font-medium text-[var(--text-muted)] leading-4">
            Description{' '}
            <span className="font-normal text-[var(--text-subtle)]">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short attribute description…"
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

        {/* Set as title field — только для текстовых типов */}
        {showTitleToggle && (
          <label className="flex items-start gap-2.5 cursor-pointer group">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-[var(--border-strong)] accent-[var(--brand)]"
            />
            <div>
              <p className="text-[13px] font-medium text-[var(--text)] group-hover:text-[var(--brand)] transition-colors">
                Set as title field
              </p>
              <p className="text-[12px] text-[var(--text-subtle)]">
                Этот атрибут будет отображаться как имя записи (Record text)
              </p>
            </div>
          </label>
        )}

        {/* Секция Options — только для select/multi-select */}
        {showOptions && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-medium text-[var(--text-muted)]">Options</p>
              <button
                type="button"
                onClick={addOption}
                className="inline-flex items-center gap-1 text-[12px] text-[var(--brand)] hover:underline"
              >
                <Plus size={12} />
                Add option
              </button>
            </div>

            {errors.options && (
              <p className="text-[12px] text-[var(--danger)]">{errors.options}</p>
            )}

            {options.length === 0 ? (
              <p className="text-[12px] text-[var(--text-subtle)] py-1">
                Нет опций. Нажмите «Add option» чтобы добавить.
              </p>
            ) : (
              <ul className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                {options.map((opt) => (
                  <li key={opt._uid} className="flex items-center gap-2">
                    {/* Цветовой круг */}
                    <input
                      type="color"
                      value={opt.color}
                      onChange={(e) => updateOption(opt._uid, 'color', e.target.value)}
                      className="h-6 w-6 rounded-full border-0 cursor-pointer bg-transparent"
                      title="Option color"
                    />
                    {/* Название опции */}
                    <input
                      type="text"
                      value={opt.label}
                      onChange={(e) => updateOption(opt._uid, 'label', e.target.value)}
                      placeholder="Option label"
                      className={clsx(
                        'flex-1 h-7 px-2 rounded-md bg-white text-[13px] text-[var(--text)]',
                        'border border-[var(--border-strong)]',
                        'placeholder:text-[var(--text-subtle)]',
                        'focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]',
                      )}
                    />
                    {/* Удалить */}
                    <button
                      type="button"
                      onClick={() => removeOption(opt._uid)}
                      className="text-[var(--text-subtle)] hover:text-[var(--danger)] transition-colors"
                      aria-label="Remove option"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* AI-поле (M2): реальная конфигурация типа/промпта/инструкций */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3">
          <AiFieldEditor
            embedded
            value={aiDraft}
            onChange={setAiDraft}
            onSave={() => {}}
            sourceAttributes={(existingAttributes ?? [])
              .filter((a) => !a.aiEnabled)
              .map((a) => ({ key: a.key, name: a.name }))}
          />
        </div>
      </form>
    </Modal>
  );
}
