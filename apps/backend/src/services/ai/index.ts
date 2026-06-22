/**
 * Основной сервис AI-атрибутов (M2, §4/§15 ТЗ).
 * Реализует 4 типа: CLASSIFY, SUMMARIZE, RESEARCH, PROMPT.
 *
 * В demo-режиме (нет ANTHROPIC_API_KEY) каждый тип возвращает
 * детерминированный результат без обращения к внешнему провайдеру.
 *
 * Конфиг AI читается из ЯВНЫХ полей Attribute (aiEnabled/aiType/aiPrompt/
 * aiGuidance/aiConfig), журнал прогонов — модели AiRun/AiBulkRun, кредиты —
 * CreditBalance/CreditTransaction (всё типизированный Prisma Client).
 *
 * Схема вызова:
 *   1) Загрузить attribute + проверить, что это AI-атрибут
 *   2) Проверить баланс кредитов
 *   3) Создать AiRun (RUNNING) + загрузить контекст записи
 *   4) Выполнить AI (реальный или demo)
 *   5) Сохранить Value, завершить AiRun (SUCCEEDED), списать кредиты, Activity
 */

import {
  ActivityType,
  AiRunStatus,
  AttributeAiType,
  AttributeType,
  Prisma,
  PrismaClient,
  ValueSource,
} from '@prisma/client';
import {
  AI_CREDIT_COSTS,
  CreditTransactionReason,
  InsufficientCreditsError,
  checkBalance,
  debitCredits,
} from './credits';
import { debitCredits as ledgerDebit, assertCredits } from '../billing/ledger'; // M16-1/M16-4: единый ledger + guard
import { llmAvailable, llmComplete } from '../llm';

const prisma = new PrismaClient();

// ─── AI-клиент ────────────────────────────────────────────────────────────
// Реальный LLM (DeepSeek/Anthropic) через единый services/llm. Без ключа — demo.

function isDemo(): boolean {
  return !llmAvailable();
}

// ─── Типы ─────────────────────────────────────────────────────────────────

export type AiType = 'CLASSIFY' | 'SUMMARIZE' | 'RESEARCH' | 'PROMPT';
export type AiRunSource = 'CELL' | 'RECORD_PAGE' | 'BOARD_CARD' | 'BULK' | 'AUTO';

/** Доп.конфиг AI-атрибута (в Attribute.aiConfig). */
interface AiExtraConfig {
  promptTemplate?: string;
  outputType?: 'TEXT' | 'NUMBER' | 'CURRENCY';
  questions?: string[];
  /** Категории для CLASSIFY, заданные в конфигураторе AI-поля (когда у атрибута нет SELECT-опций). */
  categories?: string[];
  model?: string;
  // M25-2: auto-rerun на изменение зависимостей (opt-in). sourceMode 'all_non_ai' ИЛИ явный список sourceAttributeKeys[].
  autoRerun?: boolean;
  sourceMode?: 'explicit' | 'all_non_ai';
  sourceAttributeKeys?: string[];
}

export interface AiRunResult {
  aiRunId: string;
  // M29-1: CONFLICT — ручной single-run наткнулся на ручное значение без overwrite (роут → 409);
  //         SKIPPED_MANUAL_VALUE — bulk/auto не перезаписывают ручное значение (skip без charge/provider).
  status:
    | 'SUCCEEDED'
    | 'FAILED'
    | 'QUEUED'
    | 'SKIPPED_INSUFFICIENT_CREDITS'
    | 'SKIPPED_MANUAL_VALUE'
    | 'CONFLICT'
    | 'DEDUPED';
  value: Record<string, unknown> | null;
  creditTransaction: { id: string; amount: number; type: string } | null;
}

// M29-1: триггеры, инициированные человеком напрямую (ячейка/карточка/страница) — им разрешён overwrite по подтверждению.
// BULK/AUTO — машинные, ручное значение НИКОГДА не трогают.
function isManualTrigger(source: AiRunSource): boolean {
  return source === 'CELL' || source === 'RECORD_PAGE' || source === 'BOARD_CARD';
}

// ─── Загрузка контекста записи ────────────────────────────────────────────

async function loadRecordContext(
  recordId: string,
  orgId: string,
): Promise<{ displayName: string | null; valuesText: string }> {
  const record = await prisma.record.findFirst({
    where: { id: recordId, orgId, archivedAt: null },
    include: {
      values: {
        include: {
          attribute: { select: { key: true, name: true, type: true } },
        },
      },
    },
  });

  if (!record) {
    throw new Error('Запись не найдена');
  }

  const lines: string[] = [];
  for (const v of record.values) {
    const attrName = v.attribute?.name ?? v.attributeId;
    const rawValue =
      v.textValue ??
      v.longTextValue ??
      (v.numberValue !== null ? String(v.numberValue) : null) ??
      (v.booleanValue !== null ? String(v.booleanValue) : null) ??
      (v.dateValue !== null ? v.dateValue.toISOString() : null) ??
      (v.jsonValue !== null && v.jsonValue !== undefined ? JSON.stringify(v.jsonValue) : null) ??
      null;

    if (rawValue !== null && rawValue.trim() !== '') {
      lines.push(`${attrName}: ${rawValue}`);
    }
  }

  return {
    displayName: record.displayName,
    valuesText: lines.join('\n') || '(нет заполненных полей)',
  };
}

// ─── Запись Value после AI-run ────────────────────────────────────────────

async function saveAiValue(params: {
  tx: Prisma.TransactionClient;
  orgId: string;
  recordId: string;
  attributeId: string;
  attrType: AttributeType;
  output: string;
  aiRunId: string; // M29-1: проставляем provenance — кто записал значение
}): Promise<string> {
  const { tx, orgId, recordId, attributeId, attrType, output, aiRunId } = params;

  const valueData: Prisma.ValueUncheckedCreateInput = {
    orgId,
    recordId,
    attributeId,
    textValue: null,
    longTextValue: null,
    numberValue: null,
    booleanValue: null,
    dateValue: null,
    jsonValue: Prisma.DbNull,
    currencyAmount: null,
    currencyCode: null,
    // M29-1: значение записано AI-run'ом → source=AI + ссылка на run (для guard и значка в UI).
    source: ValueSource.AI,
    lastAiRunId: aiRunId,
  };

  switch (attrType) {
    case AttributeType.TEXT:
    case AttributeType.EMAIL:
    case AttributeType.PHONE:
    case AttributeType.URL:
    case AttributeType.SELECT:
      valueData.textValue = output.slice(0, 2048);
      break;

    case AttributeType.LONG_TEXT:
      valueData.longTextValue = output;
      break;

    case AttributeType.MULTI_SELECT:
      try {
        valueData.jsonValue = JSON.parse(output) as Prisma.InputJsonValue;
      } catch {
        valueData.jsonValue = output.split(',').map((s) => s.trim()) as unknown as Prisma.InputJsonValue;
      }
      break;

    case AttributeType.NUMBER: {
      const parsed = parseFloat(output.replace(/[^0-9.-]/g, ''));
      valueData.numberValue = isNaN(parsed) ? null : new Prisma.Decimal(parsed);
      break;
    }

    case AttributeType.CURRENCY: {
      const parsed = parseFloat(output.replace(/[^0-9.-]/g, ''));
      valueData.currencyAmount = isNaN(parsed) ? null : new Prisma.Decimal(parsed);
      valueData.currencyCode = 'USD';
      break;
    }

    default:
      valueData.longTextValue = output;
      break;
  }

  const saved = await tx.value.upsert({
    where: { recordId_attributeId: { recordId, attributeId } },
    create: valueData,
    update: valueData as Prisma.ValueUncheckedUpdateInput,
  });

  return saved.id;
}

// ─── AI-исполнители по типам ──────────────────────────────────────────────

async function runClassify(params: {
  recordContext: string;
  options: string[];
  guidance?: string | null;
}): Promise<string> {
  const { recordContext, options, guidance } = params;

  if (isDemo()) {
    // Детерминированный выбор: по хэшу контекста выбираем стабильную опцию.
    const hash = [...recordContext].reduce((a, c) => a + c.charCodeAt(0), 0);
    return options[hash % options.length] ?? options[0] ?? 'Other';
  }

  const prompt = [
    'Classify the following record into EXACTLY ONE of these categories: ' + options.join(', '),
    guidance ? 'Instructions: ' + guidance : '',
    '',
    'Record data:',
    recordContext,
    '',
    'Respond with ONLY the category name, no punctuation, no explanation.',
  ]
    .filter(Boolean)
    .join('\n');

  const text = await llmComplete({ prompt, maxTokens: 64, temperature: 0 });
  // Модель может вернуть категорию с лишним текстом — ищем точное/вхождение.
  const lower = text.toLowerCase().trim();
  const match =
    options.find((o) => o.toLowerCase() === lower) ??
    options.find((o) => lower.includes(o.toLowerCase())) ??
    options.find((o) => lower.split(/[\s,.;:]+/).includes(o.toLowerCase()));
  // M25-1 (правка #3): НЕ silent-fallback на произвольную опцию — невалидный label → run FAILED.
  if (!match) {
    throw new Error(`CLASSIFY_INVALID_LABEL: model returned "${text.slice(0, 60)}" not in allowed options`);
  }
  return match;
}

async function runSummarize(params: {
  recordContext: string;
  displayName: string | null;
  guidance?: string | null;
}): Promise<string> {
  const { recordContext, displayName, guidance } = params;

  if (isDemo()) {
    const name = displayName ?? 'Запись';
    return `${name} — целевой аккаунт: профиль соответствует ICP, есть свежие сигналы к покупке. Рекомендуется к проработке агентом.`;
  }

  const prompt = [
    guidance
      ? 'Your task: ' + guidance
      : 'Summarize the key information from this record in 2-3 sentences.',
    '',
    'Record data:',
    recordContext,
    '',
    'Be concise and factual. Output only the summary text.',
  ]
    .filter(Boolean)
    .join('\n');

  return llmComplete({ prompt, maxTokens: 512 });
}

async function runResearch(params: {
  recordContext: string;
  displayName: string | null;
  questions?: string[];
  guidance?: string | null;
}): Promise<string> {
  const { recordContext, displayName, questions, guidance } = params;

  if (isDemo()) {
    const name = displayName ?? 'Компания';
    const qs = questions?.length ? questions.join('; ') : guidance ?? 'общий анализ аккаунта';
    return [
      `${name} — исследовательская сводка агента.`,
      '',
      `Фокус: ${qs}`,
      '',
      'Бизнес-модель: B2B SaaS. Стадия: Series A (оценочно). Рынки: DACH, US, CIS.',
      'Сигналы покупки: недавний найм в RevOps, миграция на новый стек, рост команды.',
      'Соответствие ICP: высокое (50–200 сотрудников, быстрорастущий продукт).',
      'Источник: demo-движок (без внешних вызовов).',
    ].join('\n');
  }

  const questionsList = questions?.length
    ? questions.map((q, i) => `${i + 1}. ${q}`).join('\n')
    : guidance ?? 'Provide a general company brief.';

  const prompt = [
    'You are a B2B research agent. Based on the record data below, answer these research questions:',
    questionsList,
    '',
    'Record data:',
    recordContext,
    '',
    'Provide a structured answer. Use the record data and general knowledge.',
    'Mark any assumptions as [estimated].',
  ]
    .filter(Boolean)
    .join('\n');

  return llmComplete({ prompt, maxTokens: 1024 });
}

async function runPrompt(params: {
  recordContext: string;
  promptTemplate: string;
  outputType?: string;
}): Promise<string> {
  const { recordContext, promptTemplate, outputType } = params;

  // Рендерим template-переменные {{key}} из recordContext
  let rendered = promptTemplate;
  for (const line of recordContext.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    rendered = rendered.replace(new RegExp(`\\{\\{\\s*${escapeRegExp(key)}\\s*\\}\\}`, 'gi'), value);
  }

  if (isDemo()) {
    if (outputType === 'NUMBER') return String((rendered.length % 90) + 10);
    if (outputType === 'CURRENCY') return String(((rendered.length % 50) + 1) * 1000);
    return rendered.replace(/\{\{[^}]+\}\}/g, '—').slice(0, 280);
  }

  const systemInstruction =
    outputType === 'NUMBER'
      ? 'Respond with ONLY a number. No text.'
      : outputType === 'CURRENCY'
        ? 'Respond with ONLY a number representing the amount in USD. No symbols, no text.'
        : 'Respond with only the requested output text.';

  const out = await llmComplete({ system: systemInstruction, prompt: rendered, maxTokens: 256, temperature: 0 });

  // M25-1 (правка #4): строгий parser для NUMBER/CURRENCY — нельзя писать текст в числовое/валютное поле.
  if (outputType === 'NUMBER' || outputType === 'CURRENCY') {
    const m = out.replace(/[,\s]/g, '').match(/-?\d+(\.\d+)?/);
    if (!m || !Number.isFinite(Number(m[0]))) {
      throw new Error(`PROMPT_NON_NUMERIC: model returned "${out.slice(0, 60)}" for a ${outputType} field`);
    }
    return m[0];
  }
  return out;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Главная функция запуска AI по записи ─────────────────────────────────

export async function runAiForRecord(params: {
  orgId: string;
  recordId: string;
  attributeId: string;
  source?: AiRunSource;
  triggeredById?: string;
  bulkRunId?: string;
  idempotencyKey?: string;       // M25-2: дедуп auto-rerun (auto-rerun:<rec>:<attr>:<sourceActivityId>)
  skipIfInsufficient?: boolean;  // M25-2: auto-rerun при 0 балансе → SKIPPED, без provider/debit/loop
  overwrite?: boolean;           // M29-1: явное согласие человека перезаписать РУЧНОЕ значение (только manual-триггеры)
}): Promise<AiRunResult> {
  const { orgId, recordId, attributeId, source = 'CELL', triggeredById, bulkRunId, idempotencyKey, skipIfInsufficient, overwrite } = params;

  // 1) Атрибут + опции
  const attribute = await prisma.attribute.findFirst({
    where: { id: attributeId, orgId, isArchived: false },
    include: {
      options: { where: { isArchived: false }, orderBy: { order: 'asc' } },
    },
  });

  if (!attribute) {
    throw new Error('Атрибут не найден');
  }

  if (!attribute.aiEnabled || !attribute.aiType) {
    throw new Error('Атрибут не является AI-атрибутом');
  }

  // M25-2: идемпотентность auto-rerun — повтор с тем же ключом → существующий AiRun (без повторного прогона/charge).
  if (idempotencyKey) {
    const dup = await prisma.aiRun.findUnique({ where: { orgId_idempotencyKey: { orgId, idempotencyKey } }, select: { id: true } });
    if (dup) return { aiRunId: dup.id, status: 'DEDUPED', value: null, creditTransaction: null };
  }

  const aiType = attribute.aiType; // AttributeAiType
  const extra = (attribute.aiConfig as AiExtraConfig | null) ?? {};
  const creditCost = AI_CREDIT_COSTS[aiType] ?? 1;
  const creditSource = aiType === 'RESEARCH' ? 'RESEARCH' : 'AI_ATTRIBUTE'; // M16-4

  // M29-1: ЗАЩИТА РУЧНОГО ЗНАЧЕНИЯ (до credit-guard и до LLM — чтобы не списать кредит/не звать провайдера зря).
  // Текущее значение source=MANUAL нельзя молча перезаписать AI.
  //   • bulk/auto (машинные) — НИКОГДА: пишем видимый SKIPPED_MANUAL_VALUE run (для аудита/счётчика), без charge/provider;
  //   • ручной single-run без overwrite → CONFLICT (роут вернёт 409, фронт спросит подтверждение);
  //   • overwrite=true (только manual-триггер) → перезаписываем как обычно.
  const currentValue = await prisma.value.findUnique({
    where: { recordId_attributeId: { recordId, attributeId } },
    select: { source: true },
  });
  if (currentValue?.source === ValueSource.MANUAL && !overwrite) {
    if (!isManualTrigger(source)) {
      try {
        const skipped = await prisma.aiRun.create({
          data: {
            orgId, attributeId, recordId,
            bulkRunId: bulkRunId ?? null,
            requestedById: triggeredById ?? null,
            aiType,
            status: AiRunStatus.SKIPPED_MANUAL_VALUE,
            creditsCost: creditCost,
            idempotencyKey: idempotencyKey ?? null,
            input: { source, reason: 'manual_value' } as Prisma.InputJsonValue,
            completedAt: new Date(),
          },
        });
        return { aiRunId: skipped.id, status: 'SKIPPED_MANUAL_VALUE', value: null, creditTransaction: null };
      } catch (e) {
        // гонка auto-rerun с тем же idempotencyKey → существующий run
        if (idempotencyKey && e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          const ex = await prisma.aiRun.findUnique({ where: { orgId_idempotencyKey: { orgId, idempotencyKey } }, select: { id: true } });
          if (ex) return { aiRunId: ex.id, status: 'DEDUPED', value: null, creditTransaction: null };
        }
        throw e;
      }
    }
    // ручной триггер без подтверждения — конфликт, без создания run и без списания
    return { aiRunId: '', status: 'CONFLICT', value: null, creditTransaction: null };
  }

  // 2) GUARD (M16-4): блок ДО создания AiRun и ДО LLM-вызова. Недостаточно → 402 (manual) ИЛИ SKIPPED (auto-rerun).
  try {
    await assertCredits(orgId, creditCost, creditSource);
  } catch (e) {
    if (skipIfInsufficient && e instanceof InsufficientCreditsError) {
      // M25-2: auto-rerun при 0 балансе — пометить SKIPPED_INSUFFICIENT_CREDITS, БЕЗ provider call/debit/retry.
      const skipped = await prisma.aiRun.create({
        data: { orgId, attributeId, recordId, bulkRunId: bulkRunId ?? null, requestedById: triggeredById ?? null, aiType, status: AiRunStatus.SKIPPED_INSUFFICIENT_CREDITS, creditsCost: creditCost, idempotencyKey: idempotencyKey ?? null, input: { source } as Prisma.InputJsonValue, completedAt: new Date() },
      });
      return { aiRunId: skipped.id, status: 'SKIPPED_INSUFFICIENT_CREDITS', value: null, creditTransaction: null };
    }
    throw e;
  }

  // 3) Создаём AiRun (RUNNING) ДО загрузки контекста — чтобы ЛЮБОЙ сбой
  //    (в т.ч. недоступная/архивированная запись) стал видимым FAILED-прогоном (M9.2/M9.4),
  //    а не молчаливым инкрементом счётчика. Кредит при провале не списывается.
  let run: { id: string };
  try {
    run = await prisma.aiRun.create({
      data: {
        orgId,
        attributeId,
        recordId,
        bulkRunId: bulkRunId ?? null,
        requestedById: triggeredById ?? null,
        aiType,
        status: AiRunStatus.RUNNING,
        creditsCost: creditCost,
        idempotencyKey: idempotencyKey ?? null,
        input: { source } as Prisma.InputJsonValue,
        startedAt: new Date(),
      },
    });
  } catch (e) {
    // гонка auto-rerun: параллельный прогон с тем же idempotencyKey создал AiRun первым → вернуть существующий
    if (idempotencyKey && e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const ex = await prisma.aiRun.findUnique({ where: { orgId_idempotencyKey: { orgId, idempotencyKey } }, select: { id: true } });
      if (ex) return { aiRunId: ex.id, status: 'DEDUPED', value: null, creditTransaction: null };
    }
    throw e;
  }

  // 4) Контекст записи + выполнение AI (всё в try: провал = FAILED-прогон, значение НЕ пишется)
  let output: string;
  let displayName: string | null = '';
  let valuesText = '';
  try {
    ({ displayName, valuesText } = await loadRecordContext(recordId, orgId));
    await prisma.aiRun.update({
      where: { id: run.id },
      data: { input: { source, displayName, valuesText: valuesText.slice(0, 4096) } as Prisma.InputJsonValue },
    });

    switch (aiType) {
      case AttributeAiType.CLASSIFY: {
        // Категории берём из SELECT-опций атрибута, иначе — из aiConfig.categories
        // (их задаёт конфигуратор AI-поля для текстовых атрибутов).
        const optionValues = attribute.options.length
          ? attribute.options.map((o) => o.label || o.value)
          : (extra.categories ?? []).map((c) => String(c)).filter(Boolean);
        if (optionValues.length === 0) {
          throw new Error('Classify-атрибут должен иметь хотя бы одну категорию (CLASSIFY_REQUIRES_OPTIONS)');
        }
        output = await runClassify({
          recordContext: valuesText,
          options: optionValues,
          guidance: attribute.aiGuidance,
        });
        break;
      }

      case AttributeAiType.SUMMARIZE:
        output = await runSummarize({
          recordContext: valuesText,
          displayName,
          guidance: attribute.aiGuidance,
        });
        break;

      case AttributeAiType.RESEARCH:
        output = await runResearch({
          recordContext: valuesText,
          displayName,
          questions: extra.questions,
          guidance: attribute.aiGuidance,
        });
        break;

      case AttributeAiType.PROMPT: {
        const template = attribute.aiPrompt ?? extra.promptTemplate;
        if (!template) {
          throw new Error('Prompt-атрибут требует шаблон (aiPrompt)');
        }
        output = await runPrompt({
          recordContext: valuesText,
          promptTemplate: template,
          outputType: extra.outputType,
        });
        break;
      }

      default:
        throw new Error('Неизвестный AI-тип: ' + aiType);
    }
  } catch (err) {
    await prisma.aiRun.update({
      where: { id: run.id },
      data: {
        status: AiRunStatus.FAILED,
        error: err instanceof Error ? err.message : String(err),
        completedAt: new Date(),
      },
    });

    return { aiRunId: run.id, status: 'FAILED', value: null, creditTransaction: null };
  }

  // 5) Сохраняем Value + Activity (транзакция), завершаем AiRun, списываем кредиты
  let valueId = '';
  let raceManual = false; // M29-1: значение стало ручным ВО ВРЕМЯ LLM-вызова (TOCTOU)
  await prisma.$transaction(async (tx) => {
    // M29-1: финальная транзакционная ре-проверка против гонки — между верхней проверкой и записью шёл
    // LLM-вызов (секунды); если человек вписал значение руками, защита ручных данных приоритетна: не пишем, не списываем.
    const cur = await tx.value.findUnique({ where: { recordId_attributeId: { recordId, attributeId } }, select: { source: true } });
    if (cur?.source === ValueSource.MANUAL && !overwrite) { raceManual = true; return; }

    valueId = await saveAiValue({
      tx,
      orgId,
      recordId,
      attributeId,
      attrType: attribute.type,
      output,
      aiRunId: run.id,
    });

    await tx.activity.create({
      data: {
        orgId,
        recordId,
        actorId: triggeredById ?? null,
        type: ActivityType.VALUE_UPDATED,
        title: 'AI updated a value',
        payload: {
          attributeId,
          attributeKey: attribute.key,
          aiType,
          aiRunId: run.id,
          source,
        } as Prisma.InputJsonValue,
      },
    });

    await tx.record.update({
      where: { id: recordId },
      data: { updatedById: triggeredById ?? null },
    });
  });

  if (raceManual) {
    await prisma.aiRun.update({
      where: { id: run.id },
      data: { status: AiRunStatus.SKIPPED_MANUAL_VALUE, error: 'manual_value_race', completedAt: new Date() },
    });
    return { aiRunId: run.id, status: 'SKIPPED_MANUAL_VALUE', value: null, creditTransaction: null };
  }

  await prisma.aiRun.update({
    where: { id: run.id },
    data: {
      status: AiRunStatus.SUCCEEDED,
      valueId,
      outputText: output.slice(0, 8192),
      output: { text: output } as Prisma.InputJsonValue,
      completedAt: new Date(),
    },
  });

  const creditReason = {
    CLASSIFY: 'AI_CLASSIFY',
    SUMMARIZE: 'AI_SUMMARIZE',
    RESEARCH: 'AI_RESEARCH',
    PROMPT: 'AI_PROMPT',
  }[aiType] as CreditTransactionReason;

  // M16-1: списание через единый hardened ledger — идемпотентно по `ai-run:<runId>` (повтор не спишет дважды).
  const creditTx = await ledgerDebit({
    orgId,
    amount: creditCost,
    source: creditSource,
    reason: creditReason,
    aiRunId: run.id,
    idempotencyKey: `ai-run:${run.id}`,
    userId: triggeredById,
    metadata: { aiType, source, recordId, attributeId },
  });

  return {
    aiRunId: run.id,
    status: 'SUCCEEDED',
    value: { output, attributeId, recordId },
    creditTransaction: {
      id: creditTx.transactionId ?? run.id,
      amount: -creditCost,
      type: 'DEBIT',
    },
  };
}

// ─── M25-2: auto-rerun AI-поля при изменении его источника ────────────────
// Вызывается из records.ts при ATTRIBUTE_UPDATED. opt-in (aiConfig.autoRerun) + явные зависимости
// (sourceAttributeKeys[] ИЛИ sourceMode 'all_non_ai'). Recursion-guard: изменение AI-поля (origin AI/auto)
// НЕ триггерит. Идемпотентность по sourceActivityId. Нехватка кредитов → SKIPPED (без provider/debit/loop).
export async function triggerAutoRerunForChange(params: {
  orgId: string;
  recordId: string;
  objectId: string;
  changedAttributeId: string;
  sourceActivityId: string;
}): Promise<void> {
  const { orgId, recordId, objectId, changedAttributeId, sourceActivityId } = params;

  // recursion-guard: источник-изменение AI-атрибута (его own write / предыдущий auto) НЕ запускает rerun
  const changed = await prisma.attribute.findFirst({ where: { id: changedAttributeId, orgId }, select: { key: true, aiEnabled: true } });
  if (!changed || changed.aiEnabled) return;

  const aiAttrs = await prisma.attribute.findMany({
    where: { orgId, objectId, isArchived: false, aiEnabled: true, aiType: { not: null } },
    select: { id: true, aiConfig: true },
  });
  for (const a of aiAttrs) {
    const cfg = (a.aiConfig as AiExtraConfig | null) ?? {};
    if (!cfg.autoRerun) continue; // opt-in
    const depends = cfg.sourceMode === 'all_non_ai' || (cfg.sourceAttributeKeys ?? []).includes(changed.key);
    if (!depends) continue;
    await runAiForRecord({
      orgId,
      recordId,
      attributeId: a.id,
      source: 'AUTO',
      idempotencyKey: `auto-rerun:${recordId}:${a.id}:${sourceActivityId}`,
      skipIfInsufficient: true,
    }).catch(() => undefined);
  }
}

// ─── Массовый запуск AI по view/выборке ──────────────────────────────────

export interface BulkAiRunResult {
  bulkRunId: string;
  estimatedCount: number;
  estimatedCost: number;
  status: 'QUEUED';
  deduped?: boolean; // M25-1: повтор с тем же clientRequestId → существующий BulkRun
}

export async function runAiBulkForView(params: {
  orgId: string;
  attributeId: string;
  recordIds: string[];
  viewId?: string;
  source?: AiRunSource;
  triggeredById?: string;
  skipExisting?: boolean;
  clientRequestId?: string;
}): Promise<BulkAiRunResult> {
  const {
    orgId,
    attributeId,
    recordIds,
    viewId,
    source = 'BULK',
    triggeredById,
    skipExisting = false,
    clientRequestId,
  } = params;

  // M25-1 (правка #6): идемпотентность создания bulk — повтор с тем же clientRequestId → существующий
  // BulkRun, без второго reserve/debit/processBulkRun.
  if (clientRequestId) {
    const dup = await prisma.aiBulkRun.findUnique({
      where: { orgId_clientRequestId: { orgId, clientRequestId } },
      select: { id: true, totalCount: true, creditsReserved: true },
    });
    if (dup) return { bulkRunId: dup.id, estimatedCount: dup.totalCount, estimatedCost: dup.creditsReserved, status: 'QUEUED', deduped: true };
  }

  const attribute = await prisma.attribute.findFirst({
    where: { id: attributeId, orgId, isArchived: false },
    select: { id: true, aiEnabled: true, aiType: true },
  });

  if (!attribute) throw new Error('Атрибут не найден');
  if (!attribute.aiEnabled || !attribute.aiType) throw new Error('Не AI-атрибут');

  const costPerRow = AI_CREDIT_COSTS[attribute.aiType] ?? 1;

  // skipExisting — исключаем записи с уже заполненным значением
  let targetIds = recordIds;
  if (skipExisting) {
    const existing = await prisma.value.findMany({
      where: { attributeId, recordId: { in: recordIds } },
      select: { recordId: true },
    });
    const existingSet = new Set(existing.map((v) => v.recordId));
    targetIds = recordIds.filter((id) => !existingSet.has(id));
  }

  const estimatedCost = targetIds.length * costPerRow;
  const bulkSource = attribute.aiType === 'RESEARCH' ? 'RESEARCH' : 'AI_ATTRIBUTE'; // M16-4

  // M16-4: GUARD — блок ДО создания BulkRun, ТОЛЬКО если нельзя оплатить даже ОДНУ строку (402 {required, available, source}).
  // Частичный bulk: per-row guard в runAiForRecord списывает ТОЛЬКО успешные строки; нехватка по ходу → строка blocked (failed), не charged.
  await assertCredits(orgId, costPerRow, bulkSource);

  let bulk: { id: string };
  try {
    bulk = await prisma.aiBulkRun.create({
      data: {
        orgId,
        attributeId,
        viewId: viewId ?? null,
        requestedById: triggeredById ?? null,
        clientRequestId: clientRequestId ?? null,
        status: AiRunStatus.PENDING,
        totalCount: targetIds.length,
        pendingCount: targetIds.length,
        successCount: 0,
        failedCount: 0,
        creditsReserved: estimatedCost,
        creditsSpent: 0,
        recordIds: targetIds as Prisma.InputJsonValue,
      },
    });
  } catch (e) {
    // гонка: параллельный запрос с тем же clientRequestId создал BulkRun первым → вернуть его (без второго reserve/debit)
    if (clientRequestId && e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const ex = await prisma.aiBulkRun.findUnique({ where: { orgId_clientRequestId: { orgId, clientRequestId } }, select: { id: true, totalCount: true, creditsReserved: true } });
      if (ex) return { bulkRunId: ex.id, estimatedCount: ex.totalCount, estimatedCost: ex.creditsReserved, status: 'QUEUED', deduped: true };
    }
    throw e;
  }

  // MVP: обрабатываем синхронно в фоне (без BullMQ), не блокируя ответ.
  void processBulkRun({
    bulkRunId: bulk.id,
    orgId,
    attributeId,
    recordIds: targetIds,
    source,
    triggeredById,
    costPerRow,
  });

  return {
    bulkRunId: bulk.id,
    estimatedCount: targetIds.length,
    estimatedCost,
    status: 'QUEUED',
  };
}

/** Внутренняя обработка batch-запуска. */
async function processBulkRun(params: {
  bulkRunId: string;
  orgId: string;
  attributeId: string;
  recordIds: string[];
  source: AiRunSource;
  triggeredById?: string;
  costPerRow: number;
}): Promise<void> {
  const { bulkRunId, orgId, attributeId, recordIds, source, triggeredById, costPerRow } = params;

  await prisma.aiBulkRun.update({
    where: { id: bulkRunId },
    data: { status: AiRunStatus.RUNNING, startedAt: new Date() },
  });

  let successCount = 0;
  let failedCount = 0;
  let skippedCount = 0; // M29-1: строки с ручным значением — пропущены guard'ом (не ошибка)

  for (const recordId of recordIds) {
    try {
      const r = await runAiForRecord({
        orgId,
        recordId,
        attributeId,
        source,
        triggeredById,
        bulkRunId,
        // overwrite НЕ передаём: bulk никогда не перезаписывает ручное значение
      });
      if (r.status === 'SUCCEEDED') successCount++;
      else if (r.status === 'SKIPPED_MANUAL_VALUE') skippedCount++;
      else failedCount++;
    } catch {
      failedCount++;
    }

    await prisma.aiBulkRun.update({
      where: { id: bulkRunId },
      data: {
        successCount,
        failedCount,
        skippedCount,
        pendingCount: recordIds.length - successCount - failedCount - skippedCount,
        creditsSpent: successCount * costPerRow,
      },
    });
  }

  await prisma.aiBulkRun.update({
    where: { id: bulkRunId },
    data: {
      status: AiRunStatus.SUCCEEDED,
      successCount,
      failedCount,
      skippedCount,
      pendingCount: 0,
      creditsSpent: successCount * costPerRow,
      completedAt: new Date(),
    },
  });
}

// ─── Статусы ──────────────────────────────────────────────────────────────

export async function getAiRunStatus(aiRunId: string, orgId: string): Promise<unknown> {
  return prisma.aiRun.findFirst({ where: { id: aiRunId, orgId } });
}

export async function getBulkRunStatus(bulkRunId: string, orgId: string): Promise<unknown> {
  return prisma.aiBulkRun.findFirst({ where: { id: bulkRunId, orgId } });
}
