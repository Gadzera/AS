'use client';

/**
 * AiAutofillSection — секция настройки AI-автозаполнения внутри модалки
 * создания/редактирования атрибута (S160, S161).
 *
 * Отображает:
 *  - Toggle «Set up AI autofill»
 *  - Dropdown выбора типа: Classify / Summarize / Research / Prompt
 *  - Textarea Guidance
 *  - Бейдж стоимости в кредитах
 *  - Предупреждение о доступе к атрибутам записи
 *
 * Используется внутри CreateAttributeModal.
 */

import React from 'react';
import clsx from 'clsx';
import { Brain, ChevronDown, Zap } from 'lucide-react';
import { useT } from '@/i18n';

// ─── Типы ─────────────────────────────────────────────────────────────────

export type AiAutofillType = 'CLASSIFY' | 'SUMMARIZE' | 'RESEARCH' | 'PROMPT';

export interface AiAutofillConfig {
  enabled: boolean;
  type: AiAutofillType | null;
  guidance: string;
}

interface AiAutofillSectionProps {
  value: AiAutofillConfig;
  onChange: (config: AiAutofillConfig) => void;
  /** Ограничивает доступные AI-типы для текущего attribute type */
  allowedTypes?: AiAutofillType[];
  /** Необязательно: текущий баланс кредитов */
  creditBalance?: number;
}

// ─── Конфиг AI-типов ──────────────────────────────────────────────────────

const AI_TYPES: Array<{
  id: AiAutofillType;
  labelKey: string;
  descKey: string;
  cost: number;
  icon: string;
}> = [
  { id: 'CLASSIFY', labelKey: 'classifyLabel', descKey: 'classifyDesc', cost: 1, icon: '🏷️' },
  { id: 'SUMMARIZE', labelKey: 'summarizeLabel', descKey: 'summarizeDesc', cost: 1, icon: '📝' },
  { id: 'RESEARCH', labelKey: 'researchLabel', descKey: 'researchDesc', cost: 10, icon: '🔍' },
  { id: 'PROMPT', labelKey: 'promptLabel', descKey: 'promptDesc', cost: 1, icon: '✨' },
];

// ─── Бейдж стоимости ──────────────────────────────────────────────────────

function CreditBadge({ cost, insufficient }: { cost: number; insufficient?: boolean }) {
  const t = useT();
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium border',
        insufficient
          ? 'bg-red-50 border-red-200 text-red-600'
          : 'bg-amber-50 border-amber-200 text-amber-700',
      )}
    >
      <Zap size={10} />
      {cost} {t(cost === 1 ? 'record.aiAutofill.creditSingular' : 'record.aiAutofill.creditPlural')} {t('record.aiAutofill.perRun')}
    </span>
  );
}

// ─── Компонент ────────────────────────────────────────────────────────────

export default function AiAutofillSection({
  value,
  onChange,
  allowedTypes,
  creditBalance,
}: AiAutofillSectionProps) {
  const t = useT();
  const [typeOpen, setTypeOpen] = React.useState(false);

  const availableTypes = allowedTypes
    ? AI_TYPES.filter((at) => allowedTypes.includes(at.id))
    : AI_TYPES;

  const selectedType = value.type ? AI_TYPES.find((at) => at.id === value.type) : null;
  const cost = selectedType?.cost ?? 1;
  const hasInsufficientCredits =
    creditBalance !== undefined && creditBalance < cost;

  function toggle() {
    onChange({
      ...value,
      enabled: !value.enabled,
      type: value.enabled ? null : 'CLASSIFY',
      guidance: '',
    });
  }

  function selectType(type: AiAutofillType) {
    onChange({ ...value, type });
    setTypeOpen(false);
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3">
      {/* Заголовок + toggle */}
      <label className="flex items-center justify-between cursor-pointer">
        <div className="flex items-center gap-2">
          <Brain size={15} className="text-purple-500" />
          <span className="text-[13px] font-medium text-[var(--text)]">{t('record.aiAutofill.setup')}</span>
          <span className="text-[11px] bg-purple-100 text-purple-700 border border-purple-200 rounded px-1.5 py-0.5 leading-tight">
            {t('record.aiAutofill.beta')}
          </span>
        </div>

        {/* Toggle switch */}
        <button
          type="button"
          role="switch"
          aria-checked={value.enabled}
          onClick={toggle}
          className={clsx(
            'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full',
            'border-2 border-transparent transition-colors duration-200 focus:outline-none',
            value.enabled ? 'bg-[var(--brand)]' : 'bg-gray-200',
          )}
        >
          <span
            className={clsx(
              'inline-block h-4 w-4 rounded-full bg-white shadow',
              'transform transition-transform duration-200',
              value.enabled ? 'translate-x-4' : 'translate-x-0',
            )}
          />
        </button>
      </label>

      {/* Развёрнутая секция настроек */}
      {value.enabled && (
        <div className="mt-1 flex flex-col gap-3 rounded-lg bg-white border border-[var(--border)] px-3 py-3">
          {/* Выбор типа AI */}
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium text-[var(--text-muted)]">
              {t('record.aiAutofill.typeLabel')}
            </label>

            <div className="relative">
              <button
                type="button"
                onClick={() => setTypeOpen((v) => !v)}
                className={clsx(
                  'w-full flex items-center justify-between h-8 px-2.5 rounded-md',
                  'bg-white text-[13px] text-[var(--text)] border border-[var(--border-strong)]',
                  'focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]',
                  'transition-colors duration-100',
                )}
              >
                <span className="flex items-center gap-1.5">
                  {selectedType ? (
                    <>
                      <span>{selectedType.icon}</span>
                      <span>{t('record.aiAutofill.' + selectedType.labelKey)}</span>
                    </>
                  ) : (
                    <span className="text-[var(--text-subtle)]">{t('record.aiAutofill.typeSelectPlaceholder')}</span>
                  )}
                </span>
                <ChevronDown size={14} className="text-[var(--text-subtle)]" />
              </button>

              {typeOpen && (
                <div
                  className={clsx(
                    'absolute z-50 mt-1 w-full rounded-lg border border-[var(--border)]',
                    'bg-white shadow-lg py-1',
                  )}
                >
                  {availableTypes.map((at) => (
                    <button
                      key={at.id}
                      type="button"
                      onClick={() => selectType(at.id)}
                      className={clsx(
                        'w-full flex items-start gap-2 px-3 py-2 text-left',
                        'hover:bg-[var(--surface-2)] transition-colors',
                        value.type === at.id && 'bg-[var(--brand-soft)]',
                      )}
                    >
                      <span className="text-base leading-5">{at.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium text-[var(--text)]">
                            {t('record.aiAutofill.' + at.labelKey)}
                          </span>
                          <CreditBadge cost={at.cost} />
                        </div>
                        <p className="text-[11px] text-[var(--text-subtle)] mt-0.5 leading-snug">
                          {t('record.aiAutofill.' + at.descKey)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Бейдж стоимости + предупреждение о балансе */}
            {selectedType && (
              <div className="flex items-center gap-2 mt-1">
                <CreditBadge cost={cost} insufficient={hasInsufficientCredits} />
                {hasInsufficientCredits && (
                  <span className="text-[11px] text-red-600">
                    {t('record.aiAutofill.insufficientCredits', { balance: creditBalance })}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Guidance */}
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium text-[var(--text-muted)]">
              {t('record.aiAutofill.guidance')}{' '}
              <span className="font-normal text-[var(--text-subtle)]">{t('record.aiAutofill.optional')}</span>
            </label>
            <textarea
              value={value.guidance}
              onChange={(e) => onChange({ ...value, guidance: e.target.value })}
              placeholder={
                value.type === 'PROMPT'
                  ? t('record.aiAutofill.promptPlaceholder')
                  : value.type === 'RESEARCH'
                    ? t('record.aiAutofill.researchPlaceholder')
                    : t('record.aiAutofill.guidanceDefaultPlaceholder')
              }
              rows={3}
              className={clsx(
                'block w-full rounded-md bg-white text-[13px] text-[var(--text)] px-2.5 py-1.5 resize-none',
                'border border-[var(--border-strong)]',
                'placeholder:text-[var(--text-subtle)]',
                'transition-colors duration-100',
                'focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]',
              )}
            />
            <p className="text-[11px] text-[var(--text-subtle)] leading-snug">
              {t('record.aiAutofill.guidanceHelp')}
            </p>
          </div>

          {/* Предупреждение об доступе к атрибутам */}
          <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-2.5 py-2">
            <span className="text-amber-600 text-[13px] leading-none mt-0.5">⚠</span>
            <p className="text-[11px] text-amber-700 leading-snug">
              {t('record.aiAutofill.attributeAccessWarning')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
