'use client';

/**
 * AiRunButton — кнопка/иконка запуска AI по одной записи.
 * Используется в:
 *  - ячейке Table (S166): compact=true, показывает иконку
 *  - record page (S167): compact=false, показывает кнопку с текстом
 *  - карточке Board (S168): compact=true
 *
 * Отображает:
 *  - Иконку/кнопку с tooltip стоимости
 *  - Состояние загрузки "AI is thinking..."
 *  - Состояние disabled при insufficient credits
 *  - Ошибку через popover/toast
 *
 * После успешного запуска вызывает onSuccess(result).
 */

import React, { useState } from 'react';
import clsx from 'clsx';
import { Sparkles, Loader2, AlertCircle } from 'lucide-react';
import crmApi from '@/lib/crmApi';
import { useT } from '@/i18n';

// ─── Типы ─────────────────────────────────────────────────────────────────

export type AiRunSource = 'CELL' | 'RECORD_PAGE' | 'BOARD_CARD';

export interface AiRunButtonProps {
  attributeId: string;
  recordId: string;
  /** Стоимость в кредитах (1 или 10) */
  creditCost?: number;
  /** Текущий баланс — если < creditCost, кнопка заблокирована */
  creditBalance?: number;
  /** Откуда запускается */
  source?: AiRunSource;
  /** Компактный режим: только иконка (для ячеек таблицы / kanban-карточек) */
  compact?: boolean;
  /** Вызывается после успешного завершения AI-run */
  onSuccess?: (result: AiRunResponse) => void;
  /** Вызывается при ошибке */
  onError?: (message: string) => void;
  className?: string;
  disabled?: boolean;
}

export interface AiRunResponse {
  aiRunId: string;
  // M29-1: CONFLICT — текущее значение ручное (server 409), нужно подтверждение перезаписи.
  status: 'SUCCEEDED' | 'FAILED' | 'QUEUED' | 'CONFLICT';
  value: Record<string, unknown> | null;
  creditTransaction: { id: string; amount: number; type: string } | null;
}

// ─── API-вызов ────────────────────────────────────────────────────────────

async function triggerAiRun(params: {
  attributeId: string;
  recordId: string;
  source: AiRunSource;
  overwrite?: boolean;
}): Promise<AiRunResponse> {
  try {
    const { data } = await crmApi.post<AiRunResponse>(
      `/attributes/${encodeURIComponent(params.attributeId)}/ai/run`,
      { recordId: params.recordId, source: params.source, overwrite: params.overwrite },
    );
    return data;
  } catch (err: unknown) {
    // M29-1: 409 — значение правлено руками. Возвращаем CONFLICT, чтобы UI спросил подтверждение.
    const status = (err as { response?: { status?: number } })?.response?.status;
    const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
    if (status === 409 && code === 'MANUAL_VALUE_CONFLICT') {
      return { aiRunId: '', status: 'CONFLICT', value: null, creditTransaction: null };
    }
    throw err;
  }
}

// ─── Компонент ────────────────────────────────────────────────────────────

export default function AiRunButton({
  attributeId,
  recordId,
  creditCost = 1,
  creditBalance,
  source = 'CELL',
  compact = true,
  onSuccess,
  onError,
  className,
  disabled = false,
}: AiRunButtonProps) {
  const t = useT();
  // M29-1: 'confirm' — наткнулись на ручное значение, ждём подтверждения перезаписи.
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'confirm'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const hasInsufficientCredits =
    creditBalance !== undefined && creditBalance < creditCost;
  const isDisabled = disabled || hasInsufficientCredits || state === 'loading';

  async function runWith(overwrite: boolean) {
    setState('loading');
    setErrorMsg(null);

    try {
      const result = await triggerAiRun({ attributeId, recordId, source, overwrite });

      // M29-1: значение ручное — показываем подтверждение перезаписи (не списываем, не перезаписываем).
      if (result.status === 'CONFLICT') {
        setState('confirm');
        return;
      }

      if (result.status === 'FAILED') {
        setState('error');
        const msg = t('record.aiRun.runFailed');
        setErrorMsg(msg);
        onError?.(msg);
        return;
      }

      setState('idle');
      onSuccess?.(result);
    } catch (err: unknown) {
      setState('error');
      const apiError =
        (err as { response?: { data?: { error?: string; code?: string } } })?.response?.data
          ?.error ?? t('record.aiRun.runError');
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;

      let userMessage = apiError;
      if (code === 'INSUFFICIENT_CREDITS') {
        userMessage = t('record.aiRun.insufficientCreditsTooltip', { n: creditCost });
      }

      setErrorMsg(userMessage);
      onError?.(userMessage);
    }
  }

  function handleRun(e: React.MouseEvent) {
    e.stopPropagation(); // чтобы не открывать модалку записи при клике на ячейку
    if (isDisabled) return;
    void runWith(false);
  }

  function handleOverwrite(e: React.MouseEvent) {
    e.stopPropagation();
    void runWith(true);
  }

  function handleCancelOverwrite(e: React.MouseEvent) {
    e.stopPropagation();
    setState('idle');
  }

  // Tooltip текст
  const tooltip = hasInsufficientCredits
    ? t('record.aiRun.insufficientCreditsTooltip', { n: creditCost })
    : state === 'loading'
      ? t('record.aiRun.thinkingTooltip')
      : t('record.aiRun.runTooltip', { n: creditCost, word: t(creditCost > 1 ? 'record.aiRun.creditPlural' : 'record.aiRun.creditSingular') });

  if (compact) {
    // Компактный режим: иконка-кнопка для ячейки таблицы / kanban-карточки
    return (
      <div className={clsx('relative inline-flex items-center', className)}>
        <button
          type="button"
          onClick={handleRun}
          disabled={isDisabled}
          title={tooltip}
          aria-label={tooltip}
          className={clsx(
            'inline-flex items-center justify-center h-5 w-5 rounded',
            'transition-all duration-150',
            isDisabled
              ? 'opacity-40 cursor-not-allowed'
              : 'hover:bg-purple-100 hover:text-purple-600 cursor-pointer',
            state === 'error'
              ? 'text-red-500'
              : state === 'loading'
                ? 'text-purple-400'
                : 'text-[var(--text-subtle)]',
          )}
        >
          {state === 'loading' ? (
            <Loader2 size={13} className="animate-spin" />
          ) : state === 'error' ? (
            <AlertCircle size={13} />
          ) : (
            <Sparkles size={13} />
          )}
        </button>

        {/* Inline error tooltip */}
        {state === 'error' && errorMsg && (
          <div
            className={clsx(
              'absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50',
              'w-max max-w-[200px] rounded-md bg-[var(--text)] text-white text-[11px] px-2 py-1',
              'shadow-lg pointer-events-none',
            )}
          >
            {errorMsg}
          </div>
        )}

        {/* M29-1: подтверждение перезаписи ручного значения */}
        {state === 'confirm' && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 w-max max-w-[230px] rounded-lg border border-[var(--border)] bg-white p-2.5 text-left shadow-lg">
            <p className="mb-2 text-[11.5px] leading-snug text-[var(--text)]">
              {t('record.aiRun.conflictPrompt')}
            </p>
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={handleCancelOverwrite}
                className="rounded border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
              >
                {t('record.aiRun.cancel')}
              </button>
              <button
                type="button"
                onClick={handleOverwrite}
                className="rounded bg-purple-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-purple-700"
              >
                {t('record.aiRun.overwrite')}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Полная кнопка для record page / action menu
  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      <button
        type="button"
        onClick={handleRun}
        disabled={isDisabled}
        className={clsx(
          'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium',
          'border transition-all duration-150 select-none',
          isDisabled
            ? 'bg-gray-50 border-[var(--border)] text-[var(--text-subtle)] cursor-not-allowed opacity-60'
            : 'bg-white border-[var(--border-strong)] text-[var(--text)]',
          !isDisabled && 'hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700',
          state === 'loading' && 'bg-purple-50 border-purple-200 text-purple-700',
          state === 'error' && 'bg-red-50 border-red-200 text-red-600',
        )}
      >
        {state === 'loading' ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            <span>{t('record.aiRun.thinkingLabel')}</span>
          </>
        ) : state === 'error' ? (
          <>
            <AlertCircle size={14} />
            <span>{t('record.aiRun.retryLabel')}</span>
          </>
        ) : (
          <>
            <Sparkles size={14} className="text-purple-500" />
            <span>{t('record.aiRun.runLabel')}</span>
            <span
              className={clsx(
                'ml-1 text-[11px] px-1.5 py-0.5 rounded border',
                hasInsufficientCredits
                  ? 'bg-red-50 border-red-200 text-red-600'
                  : 'bg-amber-50 border-amber-200 text-amber-700',
              )}
            >
              {creditCost} {t('record.ai.crAbbr')}
            </span>
          </>
        )}
      </button>

      {/* Ошибка под кнопкой */}
      {state === 'error' && errorMsg && (
        <p className="text-[12px] text-red-600 leading-snug">{errorMsg}</p>
      )}

      {/* M29-1: подтверждение перезаписи ручного значения */}
      {state === 'confirm' && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5">
          <p className="mb-2 text-[12px] leading-snug text-amber-800">
            {t('record.aiRun.conflictPrompt')}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOverwrite}
              className="inline-flex items-center gap-1 rounded-md bg-purple-600 px-2.5 py-1 text-[12px] font-semibold text-white hover:bg-purple-700"
            >
              <Sparkles size={12} /> {t('record.aiRun.overwrite')}
            </button>
            <button
              type="button"
              onClick={handleCancelOverwrite}
              className="rounded-md border border-[var(--border)] px-2.5 py-1 text-[12px] text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
            >
              {t('record.aiRun.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Предупреждение о кредитах */}
      {hasInsufficientCredits && !errorMsg && (
        <p className="text-[12px] text-[var(--text-subtle)] leading-snug">
          {t('record.aiRun.notEnoughCredits')}{' '}
          <a href="/settings/billing" className="text-[var(--brand)] hover:underline">
            {t('record.aiRun.buyMore')}
          </a>
        </p>
      )}
    </div>
  );
}

// ─── BulkAiRunButton — кнопка массового запуска (S169) ───────────────────

export interface BulkAiRunButtonProps {
  attributeId: string;
  /** ID текущего view для определения набора записей */
  viewId?: string;
  /** Явный список ID записей (альтернатива viewId) */
  recordIds?: string[];
  creditCostPerRow?: number;
  totalRows?: number;
  creditBalance?: number;
  onSuccess?: (result: BulkAiRunResponse) => void;
  onError?: (message: string) => void;
  className?: string;
}

export interface BulkAiRunResponse {
  bulkRunId: string;
  estimatedCount: number;
  estimatedCost: number;
  status: 'QUEUED';
}

export function BulkAiRunButton({
  attributeId,
  viewId,
  recordIds,
  creditCostPerRow = 1,
  totalRows = 0,
  creditBalance,
  onSuccess,
  onError,
  className,
}: BulkAiRunButtonProps) {
  const t = useT();
  const [state, setState] = useState<'idle' | 'confirming' | 'loading' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const estimatedCost = totalRows * creditCostPerRow;
  const hasInsufficientCredits =
    creditBalance !== undefined && creditBalance < estimatedCost;

  async function handleConfirm() {
    setState('loading');

    try {
      const payload: Record<string, unknown> = { skipExisting: false };
      if (viewId) payload.viewId = viewId;
      if (recordIds?.length) payload.recordIds = recordIds;

      const { data } = await crmApi.post<BulkAiRunResponse>(
        `/attributes/${encodeURIComponent(attributeId)}/ai/run-view`,
        payload,
      );

      setState('done');
      onSuccess?.(data);
    } catch (err: unknown) {
      setState('error');
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        t('record.aiRun.runError');
      setErrorMsg(msg);
      onError?.(msg);
    }
  }

  if (state === 'confirming') {
    return (
      <div
        className={clsx(
          'flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm',
          className,
        )}
      >
        <p className="text-[14px] font-semibold text-[var(--text)]">{t('record.aiRun.bulkConfirmHeader')}</p>
        <div className="text-[13px] text-[var(--text-muted)] space-y-1">
          <div className="flex items-center justify-between">
            <span>{t('record.aiRun.bulkRowsLabel')}</span>
            <strong>{totalRows}</strong>
          </div>
          <div className="flex items-center justify-between">
            <span>{t('record.aiRun.bulkCostPerRow')}</span>
            <strong>{creditCostPerRow} {t(creditCostPerRow > 1 ? 'record.aiRun.creditPlural' : 'record.aiRun.creditSingular')}</strong>
          </div>
          <div className="flex items-center justify-between border-t border-[var(--border)] pt-1 mt-1">
            <span className="font-medium text-[var(--text)]">{t('record.aiRun.bulkTotalCost')}</span>
            <strong
              className={clsx(
                'text-[14px]',
                hasInsufficientCredits ? 'text-red-600' : 'text-amber-700',
              )}
            >
              {estimatedCost} {t('record.aiRun.creditPlural')}
            </strong>
          </div>
        </div>

        {hasInsufficientCredits && (
          <p className="text-[12px] text-red-600 bg-red-50 rounded px-2 py-1.5">
            {t('record.aiRun.bulkInsufficientInConfirm', { n: creditBalance })}{' '}
            <a href="/settings/billing" className="underline">{t('record.aiRun.buyMore')}</a>
          </p>
        )}

        <div className="flex items-center gap-2 justify-end">
          <button
            type="button"
            onClick={() => setState('idle')}
            className="rounded-md px-3 py-1.5 text-[13px] text-[var(--text-muted)] hover:bg-[var(--surface-2)] border border-[var(--border)] transition-colors"
          >
            {t('record.aiRun.cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={hasInsufficientCredits}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium',
              'bg-purple-600 text-white border border-purple-700 transition-colors',
              hasInsufficientCredits
                ? 'opacity-40 cursor-not-allowed'
                : 'hover:bg-purple-700 cursor-pointer',
            )}
          >
            <Sparkles size={13} />
            {t('record.aiRun.runLabel')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      <button
        type="button"
        onClick={() => setState('confirming')}
        disabled={state === 'loading' || state === 'done'}
        className={clsx(
          'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium',
          'border border-[var(--border-strong)] bg-white text-[var(--text)]',
          'hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700',
          'transition-all duration-150',
          state === 'done' && 'opacity-60',
          state === 'loading' && 'opacity-60 cursor-not-allowed',
        )}
      >
        {state === 'loading' ? (
          <>
            <Loader2 size={13} className="animate-spin" />
            <span>{t('record.aiRun.bulkRunning', { n: totalRows })}</span>
          </>
        ) : state === 'done' ? (
          <>
            <Sparkles size={13} className="text-purple-500" />
            <span>{t('record.aiRun.bulkQueued')}</span>
          </>
        ) : (
          <>
            <Sparkles size={13} className="text-purple-500" />
            <span>{t('record.aiRun.bulkRunAll')}</span>
          </>
        )}
      </button>

      {state === 'error' && errorMsg && (
        <p className="text-[12px] text-red-600">{errorMsg}</p>
      )}
    </div>
  );
}
