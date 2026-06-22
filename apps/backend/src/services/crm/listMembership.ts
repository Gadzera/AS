/**
 * LST-1 (Module 6 Lists · dynamic): вычисляемое членство DYNAMIC-списков.
 *
 * Принципы (план GPT, /c/6a2fd6d8):
 *  • DYNAMIC = pure computed-on-read. Членство = записи primaryObject, матчащие config.rule.
 *    НИКАКИХ ListEntry для DYNAMIC (ручной pin/exclude отсутствует).
 *  • rule — тот же контракт filterTree, что Views/Reports/Data Hub. Считаем через ОБЩИЙ движок
 *    recordFilter.ts (compileFilterTree/matchesCompiledTree) — второго движка нет.
 *  • Отдельный error-namespace для правила списка (INVALID_LIST_RULE / LIST_RULE_ATTRIBUTE_NOT_FOUND /
 *    UNSUPPORTED_LIST_RULE_OPERATOR), чтобы UI правила списка не путать с фильтром представления.
 *  • create/update = strict (невалид → 422 в namespace списка); read = lenient + warnings (archived attr
 *    не ломает открытие списка).
 *  • Пустой rule → ПУСТОЙ список (не «все»), честно. NULL rule трактуется так же.
 */

import { Prisma, PrismaClient } from '@prisma/client';
import {
  compileFilterTree,
  matchesCompiledTree,
  FilterTreeError,
  type AttributeLite,
  type CompiledNode,
} from './recordFilter';
import { recordSerializationInclude } from './values';

// Жёсткий потолок сканирования records для computed membership (как и STATIC-пайплайн, фильтр идёт
// в памяти; cap защищает от чрезмерной выборки на больших объектах). truncated сигнализируется наружу.
export const DYNAMIC_MEMBER_SCAN_CAP = 5000;

/** Ошибка валидации правила DYNAMIC-списка — отдельный namespace поверх общего FilterTreeError. */
export class ListRuleError extends Error {
  statusCode: number;
  code: string;
  constructor(message: string, code: string, statusCode = 422) {
    super(message);
    this.name = 'ListRuleError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

// Маппинг кодов общего фильтр-движка → namespace правила списка.
const RULE_CODE_MAP: Record<string, string> = {
  INVALID_FILTER_TREE: 'INVALID_LIST_RULE',
  FILTER_ATTRIBUTE_NOT_FOUND: 'LIST_RULE_ATTRIBUTE_NOT_FOUND',
  UNSUPPORTED_OPERATOR_FOR_TYPE: 'UNSUPPORTED_LIST_RULE_OPERATOR',
};

/**
 * Компилирует правило DYNAMIC-списка через ОБЩИЙ движок, но любую FilterTreeError перекладывает
 * в namespace списка. strict=true (save/preview) → бросает ListRuleError; strict=false (read) → lenient.
 */
export function compileListRule(
  raw: unknown,
  attributeByKey: (key: string) => AttributeLite | undefined,
  opts: { strict: boolean },
): { tree: CompiledNode | null; warnings: string[] } {
  try {
    return compileFilterTree(raw, attributeByKey, opts);
  } catch (err) {
    if (err instanceof FilterTreeError) {
      const message = err.message.replace(/^Filter/, 'List rule');
      throw new ListRuleError(message, RULE_CODE_MAP[err.code] ?? 'INVALID_LIST_RULE', err.statusCode);
    }
    throw err;
  }
}

/** Достаёт rule (filterTree) из List.config. Возвращает undefined, если правила нет. */
export function readListRule(config: Prisma.JsonValue | null | undefined): unknown {
  if (config && typeof config === 'object' && !Array.isArray(config)) {
    const rule = (config as Record<string, unknown>).rule;
    return rule ?? undefined;
  }
  return undefined;
}

/** Считает rule «заданным» (непустой объект/дерево). NULL/undefined/{} → не задан → пустой список. */
export function hasListRule(rule: unknown): boolean {
  if (rule === null || rule === undefined) return false;
  if (typeof rule === 'object' && !Array.isArray(rule)) {
    return Object.keys(rule as Record<string, unknown>).length > 0;
  }
  return true;
}

export type DynamicMember = Prisma.RecordGetPayload<{ include: typeof recordSerializationInclude }>;

/**
 * Вычисляет членов DYNAMIC-списка: записи primaryObject (не архив), матчащие правило.
 * Пустой/незаданный rule → ПУСТО (не «все»). На read правило компилируется lenient (warnings).
 * Возвращает уже отфильтрованные по правилу записи + warnings + флаг truncated (cap сработал).
 */
export async function computeDynamicMembers(
  prisma: PrismaClient | Prisma.TransactionClient,
  orgId: string,
  primaryObjectId: string,
  rule: unknown,
  attrByKey: (key: string) => AttributeLite | undefined,
): Promise<{ records: DynamicMember[]; warnings: string[]; truncated: boolean }> {
  // Незаданное/пустое правило — список пуст. Не читаем БД, не раскрываем «всё».
  if (!hasListRule(rule)) {
    return { records: [], warnings: [], truncated: false };
  }

  const { tree, warnings } = compileListRule(rule, attrByKey, { strict: false });
  // Lenient-компиляция могла схлопнуть всё дерево (все листья невалидны) → пустой список + warning.
  if (!tree) {
    return { records: [], warnings, truncated: false };
  }

  // Читаем кандидатов с потолком: cap+1, чтобы честно отметить truncated.
  const candidates = await prisma.record.findMany({
    where: { orgId, objectId: primaryObjectId, archivedAt: null },
    include: recordSerializationInclude,
    orderBy: [{ createdAt: 'asc' }],
    take: DYNAMIC_MEMBER_SCAN_CAP + 1,
  });
  const truncated = candidates.length > DYNAMIC_MEMBER_SCAN_CAP;
  const scanned = truncated ? candidates.slice(0, DYNAMIC_MEMBER_SCAN_CAP) : candidates;

  const records = scanned.filter((record) => matchesCompiledTree(record, tree));
  if (truncated) {
    warnings.push(`Dynamic membership scan capped at ${DYNAMIC_MEMBER_SCAN_CAP} records — count may be incomplete.`);
  }
  return { records, warnings, truncated };
}
