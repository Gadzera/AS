/**
 * M27-1: безопасная сериализация активностей записи с redaction по правам (обязательная правка GPT #1).
 *
 * Принцип: GET /records/:id/activities НЕ отдаёт сырой payload (внутренние id/детали). Для активностей,
 * раскрывающих ДРУГУЮ сущность (связанная запись на другом объекте / список), проверяем доступ зрителя:
 *  - нет доступа к sub-entity → отдаём только { id, type, actor, createdAt, redacted:true } (без title/body);
 *  - есть доступ (или активность «о самой записи», к которой уже есть OBJECT READ) → title/body, без payload.
 *
 * Дёшево: один batch-резолв objectId для «других» записей + готовые AccessResolver (OBJECT/LIST) на запрос.
 */
import { AccessLevel } from '@prisma/client';
import { meets } from '../permissions';

export interface RawActivity {
  id: string;
  type: string;
  title: string | null;
  body: string | null;
  payload: unknown;
  createdAt: Date;
  actor: { id: string; name: string | null; email: string } | null;
}

export interface SafeActivity {
  id: string;
  type: string;
  title?: string | null;
  body?: string | null;
  createdAt: Date;
  actor: { id: string; name: string | null; email: string } | null;
  redacted: boolean;
}

const LIST_TYPES = new Set(['RECORD_ADDED_TO_LIST', 'RECORD_REMOVED_FROM_LIST', 'LIST_STAGE_CHANGED']);
const REL_TYPES = new Set(['RELATIONSHIP_CREATED', 'RELATIONSHIP_REMOVED']);

function payloadObj(p: unknown): Record<string, unknown> {
  return p && typeof p === 'object' && !Array.isArray(p) ? (p as Record<string, unknown>) : {};
}

/**
 * Сущности, которые активность раскрывает помимо самой записи (для проверки прав).
 * kind помечает КРОСС-сущностные типы даже если id не извлёкся — тогда fail-closed (redacted),
 * а не «self» (защита от legacy list-активностей без listId и будущих REL-fire-site'ов без id).
 */
export function activityRefs(a: { type: string; payload: unknown }): { kind: 'list' | 'relationship' | 'self'; listId?: string; otherRecordId?: string } {
  const p = payloadObj(a.payload);
  if (LIST_TYPES.has(a.type)) {
    return { kind: 'list', listId: typeof p.listId === 'string' ? p.listId : undefined };
  }
  if (REL_TYPES.has(a.type) || p.reverse === true) {
    const other = (typeof p.targetRecordId === 'string' && p.targetRecordId)
      || (typeof p.sourceRecordId === 'string' && p.sourceRecordId)
      || undefined;
    return { kind: 'relationship', otherRecordId: other || undefined };
  }
  return { kind: 'self' };
}

/** Все «другие» recordId, упомянутые в активностях (для batch-резолва их objectId). */
export function collectOtherRecordIds(activities: ReadonlyArray<{ type: string; payload: unknown }>): string[] {
  const ids = new Set<string>();
  for (const a of activities) {
    const r = activityRefs(a);
    if (r.otherRecordId) ids.add(r.otherRecordId);
  }
  return [...ids];
}

/**
 * Применяет redaction. viewer уже имеет OBJECT READ на саму запись (проверено в роуте).
 *  - objectAccess(objectId) / listAccess(listId) — резолверы прав зрителя;
 *  - recordObject — map otherRecordId → objectId (batch, заранее).
 */
export function redactActivities(
  activities: ReadonlyArray<RawActivity>,
  opts: {
    objectAccess: (objectId?: string | null) => AccessLevel;
    listAccess: (listId?: string | null) => AccessLevel;
    recordObject: Map<string, string>; // otherRecordId → objectId
  },
): SafeActivity[] {
  return activities.map((a) => {
    const base = { id: a.id, type: a.type, createdAt: a.createdAt, actor: a.actor };
    const refs = activityRefs(a);

    let allowed = true;
    if (refs.kind === 'list') {
      // активность раскрывает список → нужен LIST READ. Нет listId (legacy) → fail-closed (redacted).
      allowed = refs.listId !== undefined && meets(opts.listAccess(refs.listId), 'READ');
    } else if (refs.kind === 'relationship') {
      // активность раскрывает другую запись → нужен OBJECT READ на её объект. Нет id/запись недоступна → fail-closed.
      const objId = refs.otherRecordId ? opts.recordObject.get(refs.otherRecordId) : undefined;
      allowed = !!objId && meets(opts.objectAccess(objId), 'READ');
    }
    // 'self' (о самой записи) — уже видимо (OBJECT READ на запись есть на уровне роута).

    if (!allowed) {
      return { ...base, redacted: true };
    }
    // payload НИКОГДА не отдаём наружу (внутренние id/детали). title/body — человеко-читаемое.
    return { ...base, title: a.title, body: a.body, redacted: false };
  });
}
