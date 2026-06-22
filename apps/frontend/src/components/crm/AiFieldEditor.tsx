'use client';

/**
 * AiFieldEditor — конфигуратор AI-атрибута (M2).
 *
 * Превращает обычный атрибут в «AI-поле»: агент сам заполняет значение по
 * выбранному типу (CLASSIFY / SUMMARIZE / RESEARCH / PROMPT) + промпт/инструкции.
 *
 * Контролируемый компонент: состояние ведёт родитель через value/onChange,
 * сохранение — кнопкой (onSave). Бэкенд: PATCH /api/objects/:id/attributes/:attrId
 * (поля aiEnabled/aiType/aiPrompt/aiGuidance/aiConfig).
 */

import { useState } from 'react';
import {
  Sparkles,
  Tags,
  FileText,
  Globe,
  Wand2,
  Loader2,
  Check,
  RefreshCw,
} from 'lucide-react';
import clsx from 'clsx';
import type { AiAttributeFields } from '@/lib/crmApi';

export type AiTypeValue = 'CLASSIFY' | 'SUMMARIZE' | 'RESEARCH' | 'PROMPT';

/** Режим источника для auto-rerun (M25-2): только явные поля или все не-AI поля. */
export type AiSourceMode = 'explicit' | 'all_non_ai';

export interface AiFieldDraft {
  aiEnabled: boolean;
  aiType: AiTypeValue | null;
  aiPrompt: string;
  aiGuidance: string;
  /** Категории для CLASSIFY (одна на строку) */
  categories: string;
  /** M25-2: автоматически перезапускать AI-поле при изменении зависимостей */
  autoRerun: boolean;
  /** M25-2: какие изменения триггерят пересчёт (по умолчанию — явный список) */
  sourceMode: AiSourceMode;
  /** M25-2: ключи атрибутов-зависимостей (для sourceMode='explicit') */
  sourceAttributeKeys: string[];
}

interface AiTypeMeta {
  value: AiTypeValue;
  label: string;
  desc: string;
  cost: number;
  icon: typeof Tags;
}

const AI_TYPES: AiTypeMeta[] = [
  { value: 'CLASSIFY', label: 'Classify', desc: 'Sort a record into one of the categories', cost: 1, icon: Tags },
  { value: 'SUMMARIZE', label: 'Summarize', desc: 'Short summary of the record data', cost: 1, icon: FileText },
  { value: 'RESEARCH', label: 'Research', desc: 'Deep research from external sources', cost: 10, icon: Globe },
  { value: 'PROMPT', label: 'Custom prompt', desc: 'Free-form instruction to the agent', cost: 1, icon: Wand2 },
];

/** Привести AiAttributeFields (с бэка) к черновику редактора. */
export function aiFieldsToDraft(attr: AiAttributeFields): AiFieldDraft {
  const cfg = attr.aiConfig ?? {};
  const cats = (cfg.categories as string[] | undefined) ?? [];
  const mode = cfg.sourceMode === 'all_non_ai' ? 'all_non_ai' : 'explicit';
  const keys = Array.isArray(cfg.sourceAttributeKeys)
    ? (cfg.sourceAttributeKeys as unknown[]).filter((k): k is string => typeof k === 'string')
    : [];
  return {
    aiEnabled: attr.aiEnabled ?? false,
    aiType: (attr.aiType as AiTypeValue | null) ?? null,
    aiPrompt: attr.aiPrompt ?? '',
    aiGuidance: attr.aiGuidance ?? '',
    categories: cats.join('\n'),
    autoRerun: cfg.autoRerun === true,
    sourceMode: mode,
    sourceAttributeKeys: keys,
  };
}

/** Привести черновик к payload для updateAttribute. */
export function draftToPayload(draft: AiFieldDraft): AiAttributeFields {
  const categories = draft.categories
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  // M25-2: aiConfig склеивает категории CLASSIFY и контракт auto-rerun.
  // Auto-rerun строго opt-in: пишем поля только когда тумблер включён.
  const aiConfig: Record<string, unknown> = {};
  if (draft.aiEnabled && draft.aiType === 'CLASSIFY' && categories.length) {
    aiConfig.categories = categories;
  }
  if (draft.aiEnabled && draft.autoRerun) {
    aiConfig.autoRerun = true;
    aiConfig.sourceMode = draft.sourceMode;
    // Явные зависимости передаём ТОЛЬКО для режима explicit (контракт GPT M25-2).
    if (draft.sourceMode === 'explicit') {
      aiConfig.sourceAttributeKeys = [...new Set(draft.sourceAttributeKeys)];
    }
  }

  return {
    aiEnabled: draft.aiEnabled,
    aiType: draft.aiEnabled ? draft.aiType : null,
    aiPrompt: draft.aiPrompt.trim() || null,
    aiGuidance: draft.aiGuidance.trim() || null,
    aiConfig: draft.aiEnabled && Object.keys(aiConfig).length ? aiConfig : null,
  };
}

interface AiFieldEditorProps {
  value: AiFieldDraft;
  onChange: (next: AiFieldDraft) => void;
  onSave: () => void | Promise<void>;
  saving?: boolean;
  saved?: boolean;
  /** Скрыть кнопку сохранения (когда используется внутри формы создания) */
  embedded?: boolean;
  /**
   * Метки SELECT-опций атрибута. Если заданы — для CLASSIFY они являются
   * источником категорий (так делает backend), и редактор показывает их
   * read-only вместо textarea свободных категорий.
   */
  selectOptions?: string[];
  /**
   * M25-2: не-AI атрибуты того же объекта — кандидаты в зависимости auto-rerun.
   * Если заданы — для sourceMode='explicit' показываем чекбоксы полей.
   */
  sourceAttributes?: { key: string; name: string }[];
}

export default function AiFieldEditor({
  value,
  onChange,
  onSave,
  saving,
  saved,
  embedded,
  selectOptions,
  sourceAttributes,
}: AiFieldEditorProps) {
  const [touched, setTouched] = useState(false);

  function patch(p: Partial<AiFieldDraft>) {
    setTouched(true);
    onChange({ ...value, ...p });
  }

  const activeType = AI_TYPES.find((t) => t.value === value.aiType) ?? null;
  const promptLabel =
    value.aiType === 'PROMPT'
      ? 'Instruction to the agent'
      : value.aiType === 'CLASSIFY'
        ? 'How to classify (optional)'
        : value.aiType === 'RESEARCH'
          ? 'What to look for (optional)'
          : 'Extra instruction (optional)';

  return (
    <div className="space-y-4">
      {/* Тумблер «это AI-поле» */}
      <label className="flex items-center justify-between cursor-pointer rounded-xl border border-line bg-surface-2/40 px-3.5 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
            <Sparkles size={15} strokeWidth={2} />
          </span>
          <div>
            <p className="text-[13px] font-semibold text-ink">AI field</p>
            <p className="text-[12px] text-ink-muted">The agent fills the value from the record data</p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={value.aiEnabled}
          onClick={() => patch({ aiEnabled: !value.aiEnabled, aiType: !value.aiEnabled && !value.aiType ? 'SUMMARIZE' : value.aiType })}
          className={clsx(
            'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
            value.aiEnabled ? 'bg-brand-600' : 'bg-gray-200',
          )}
        >
          <span
            className={clsx(
              'inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200',
              value.aiEnabled ? 'translate-x-4' : 'translate-x-0',
            )}
          />
        </button>
      </label>

      {value.aiEnabled && (
        <>
          {/* Выбор типа */}
          <div>
            <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">Type</p>
            <div className="grid grid-cols-2 gap-2">
              {AI_TYPES.map((t) => {
                const Icon = t.icon;
                const active = value.aiType === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => patch({ aiType: t.value })}
                    className={clsx(
                      'flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors',
                      active
                        ? 'border-brand-400 bg-brand-50 ring-1 ring-brand-200'
                        : 'border-line bg-surface hover:border-line-strong hover:bg-surface-2',
                    )}
                  >
                    <span className={clsx('mt-0.5 shrink-0', active ? 'text-brand-600' : 'text-ink-subtle')}>
                      <Icon size={16} strokeWidth={1.9} />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="text-[13px] font-semibold text-ink">{t.label}</span>
                        <span className="rounded bg-surface-2 px-1 py-0.5 text-[10px] font-medium text-ink-subtle">
                          {t.cost} cr
                        </span>
                      </span>
                      <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-muted">{t.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Категории — только для CLASSIFY */}
          {value.aiType === 'CLASSIFY' && (
            selectOptions && selectOptions.length > 0 ? (
              // Атрибут типа SELECT — категории берутся из его опций (источник правды на backend).
              <div>
                <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">Categories</p>
                <div className="flex flex-wrap gap-1.5 rounded-lg border border-line bg-surface-2/40 px-3 py-2.5">
                  {selectOptions.map((o) => (
                    <span key={o} className="rounded-md bg-surface px-2 py-0.5 text-[12px] font-medium text-ink ring-1 ring-inset ring-line-strong">{o}</span>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-ink-subtle">Taken from the SELECT attribute options. Change them in its settings.</p>
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">
                  Categories <span className="font-normal normal-case tracking-normal text-ink-subtle">(one per line)</span>
                </label>
                <textarea
                  value={value.categories}
                  onChange={(e) => patch({ categories: e.target.value })}
                  rows={4}
                  placeholder={'Enterprise\nMid-market\nSMB\nNot a fit'}
                  className="w-full resize-none rounded-lg border border-line-strong bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-ink-subtle focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              </div>
            )
          )}

          {/* Промпт */}
          <div>
            <label className="mb-1 block text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">
              {promptLabel}
            </label>
            <textarea
              value={value.aiPrompt}
              onChange={(e) => patch({ aiPrompt: e.target.value })}
              rows={3}
              placeholder={
                value.aiType === 'PROMPT'
                  ? 'e.g. “Detect whether the company uses React from its site and job posts”'
                  : 'Clarify what to focus on…'
              }
              className="w-full resize-none rounded-lg border border-line-strong bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-ink-subtle focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          {/* Тон/правила */}
          <div>
            <label className="mb-1 block text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">
              Tone and constraints <span className="font-normal normal-case tracking-normal text-ink-subtle">(optional)</span>
            </label>
            <input
              value={value.aiGuidance}
              onChange={(e) => patch({ aiGuidance: e.target.value })}
              placeholder="e.g. concise, in English, no fluff"
              className="h-9 w-full rounded-lg border border-line-strong bg-surface px-3 text-[13px] text-ink placeholder:text-ink-subtle focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          {/* M25-2: Auto-rerun — пересчёт при изменении зависимостей (строго opt-in) */}
          <div className="rounded-xl border border-line bg-surface-2/40 p-3">
            <label className="flex cursor-pointer items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
                  <RefreshCw size={14} strokeWidth={2} />
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-ink">Auto-rerun on changes</p>
                  <p className="text-[12px] text-ink-muted">Regenerate this field when its source data changes</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={value.autoRerun}
                onClick={() => patch({ autoRerun: !value.autoRerun })}
                className={clsx(
                  'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
                  value.autoRerun ? 'bg-brand-600' : 'bg-gray-200',
                )}
              >
                <span
                  className={clsx(
                    'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200',
                    value.autoRerun ? 'translate-x-4' : 'translate-x-0',
                  )}
                />
              </button>
            </label>

            {value.autoRerun && (
              <div className="mt-3 space-y-2">
                {/* Режим источника — opt-in контракт: explicit list ИЛИ all non-AI */}
                <div className="grid grid-cols-1 gap-1.5">
                  {(['explicit', 'all_non_ai'] as AiSourceMode[]).map((m) => {
                    const active = value.sourceMode === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => patch({ sourceMode: m })}
                        className={clsx(
                          'flex items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors',
                          active ? 'border-brand-400 bg-brand-50 ring-1 ring-brand-200' : 'border-line bg-surface hover:bg-surface-2',
                        )}
                      >
                        <span className={clsx('mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border-2', active ? 'border-brand-600 bg-brand-600' : 'border-line-strong')} />
                        <span className="min-w-0">
                          <span className="block text-[12.5px] font-semibold text-ink">{m === 'explicit' ? 'Only specific fields' : 'Any non-AI field'}</span>
                          <span className="block text-[11px] text-ink-muted">
                            {m === 'explicit' ? 'Rerun only when the fields you pick below change' : 'Rerun when any regular (non-AI) field of the record changes'}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Явные зависимости (для explicit) */}
                {value.sourceMode === 'explicit' &&
                  (sourceAttributes && sourceAttributes.length > 0 ? (
                    <div>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">Source fields</p>
                      <div className="flex flex-wrap gap-1.5">
                        {sourceAttributes.map((s) => {
                          const on = value.sourceAttributeKeys.includes(s.key);
                          return (
                            <button
                              key={s.key}
                              type="button"
                              onClick={() =>
                                patch({
                                  sourceAttributeKeys: on
                                    ? value.sourceAttributeKeys.filter((k) => k !== s.key)
                                    : [...value.sourceAttributeKeys, s.key],
                                })
                              }
                              className={clsx(
                                'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[12px] font-medium transition-colors',
                                on ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-line bg-surface text-ink-muted hover:bg-surface-2',
                              )}
                            >
                              {on && <Check size={11} />} {s.name}
                            </button>
                          );
                        })}
                      </div>
                      {value.sourceAttributeKeys.length === 0 && (
                        <p className="mt-1 text-[11px] text-amber-600">Pick at least one field — otherwise auto-rerun never fires.</p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">
                        Source field keys <span className="font-normal normal-case tracking-normal text-ink-subtle">(comma-separated)</span>
                      </label>
                      <input
                        value={value.sourceAttributeKeys.join(', ')}
                        onChange={(e) => patch({ sourceAttributeKeys: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                        placeholder="e.g. description, website, industry"
                        className="h-9 w-full rounded-lg border border-line-strong bg-surface px-3 text-[13px] text-ink placeholder:text-ink-subtle focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                      />
                    </div>
                  ))}

                <p className="text-[11px] text-ink-subtle">
                  Changes the agent makes itself never trigger a rerun (no loops). Each auto-rerun costs the same credits as a manual run; at zero balance it is skipped, not charged.
                </p>
              </div>
            )}
          </div>

          {activeType && (
            <p className="text-[12px] text-ink-muted">
              Each run costs <span className="font-semibold text-ink">{activeType.cost}</span>{' '}
              {activeType.cost === 1 ? 'credit' : 'credits'} from the organization balance.
            </p>
          )}
        </>
      )}

      {!embedded && (
        <div className="flex items-center justify-end gap-2 pt-1">
          {saved && !touched && (
            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-600">
              <Check size={14} /> Saved
            </span>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setTouched(false);
              onSave();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 h-9 text-[13px] font-semibold text-white shadow-brand transition-colors hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Сохранить AI-настройки
          </button>
        </div>
      )}
    </div>
  );
}
