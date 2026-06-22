/**
 * M28-1 — Generic recipient resolver (правка GPT #1).
 *
 * НЕ hardcode по объектам. Получатели письма для записи резолвятся честно:
 *  • self  — у самой записи есть EMAIL-атрибут со значением (запись «человек»);
 *  • related — связанные записи (через forward RelationshipValue этой записи И reverse-связи на неё),
 *    у которых есть EMAIL-значение (например, People, связанные со сделкой/компанией).
 *
 * Ручной email — НЕ здесь: он допускается только в single-compose как явный ввод (route-уровень),
 * а в bulk без явного preview запрещён. Этот резолвер отдаёт ТОЛЬКО реально резолвимые из CRM адреса.
 */
import { AttributeType, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type RecipientCandidate = {
  recordId: string;
  objectKey: string | null;
  objectName: string | null;
  displayName: string | null;
  email: string;
  source: 'self' | 'related';
  relationLabel: string | null; // имя атрибута/связи, через которую найден получатель (для related)
};

// EMAIL-значения пачки записей: recordId → первый непустой email (lower-case). Источник истины — Value(textValue) у EMAIL-атрибутов.
async function emailsForRecords(orgId: string, recordIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (recordIds.length === 0) return out;
  const values = await prisma.value.findMany({
    where: { orgId, recordId: { in: recordIds }, attribute: { type: AttributeType.EMAIL, isArchived: false }, NOT: { textValue: null } },
    select: { recordId: true, textValue: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  for (const v of values) {
    const email = (v.textValue ?? '').trim().toLowerCase();
    if (email && !out.has(v.recordId)) out.set(v.recordId, email);
  }
  return out;
}

// Метаданные записей (object key/name + displayName) пачкой.
async function recordMeta(orgId: string, recordIds: string[]): Promise<Map<string, { objectKey: string | null; objectName: string | null; displayName: string | null }>> {
  const out = new Map<string, { objectKey: string | null; objectName: string | null; displayName: string | null }>();
  if (recordIds.length === 0) return out;
  const recs = await prisma.record.findMany({
    where: { orgId, id: { in: recordIds }, archivedAt: null },
    select: { id: true, displayName: true, object: { select: { key: true, singularName: true } } },
  });
  for (const r of recs) out.set(r.id, { objectKey: r.object?.key ?? null, objectName: r.object?.singularName ?? null, displayName: r.displayName });
  return out;
}

/**
 * Резолвит список реально достижимых получателей для записи.
 * Дедуп по email (case-insensitive): self имеет приоритет над related, первый related-источник побеждает.
 */
export async function resolveRecipients(orgId: string, recordId: string): Promise<RecipientCandidate[]> {
  const record = await prisma.record.findFirst({
    where: { id: recordId, orgId, archivedAt: null },
    select: { id: true, displayName: true, object: { select: { key: true, singularName: true } } },
  });
  if (!record) return [];

  const candidates: RecipientCandidate[] = [];

  // 1) self — email самой записи
  const selfEmails = await emailsForRecords(orgId, [recordId]);
  const selfEmail = selfEmails.get(recordId);
  if (selfEmail) {
    candidates.push({
      recordId, objectKey: record.object?.key ?? null, objectName: record.object?.singularName ?? null,
      displayName: record.displayName, email: selfEmail, source: 'self', relationLabel: null,
    });
  }

  // 2) forward-связи этой записи → целевые записи, у которых есть email
  const forward = await prisma.relationshipValue.findMany({
    where: { orgId, sourceRecordId: recordId },
    select: { targetRecordId: true, sourceAttribute: { select: { name: true, key: true } } },
  });
  // 3) reverse-связи: записи, ссылающиеся НА эту → у них тоже могут быть контакты
  const reverse = await prisma.relationshipValue.findMany({
    where: { orgId, targetRecordId: recordId },
    select: { sourceRecordId: true, sourceAttribute: { select: { name: true, key: true } } },
  });

  // карта relatedRecordId → relationLabel (первый встреченный)
  const relatedLabel = new Map<string, string>();
  for (const f of forward) if (!relatedLabel.has(f.targetRecordId)) relatedLabel.set(f.targetRecordId, f.sourceAttribute?.name ?? f.sourceAttribute?.key ?? 'Related');
  for (const r of reverse) if (!relatedLabel.has(r.sourceRecordId)) relatedLabel.set(r.sourceRecordId, r.sourceAttribute?.name ?? r.sourceAttribute?.key ?? 'Related');

  const relatedIds = Array.from(relatedLabel.keys()).filter((id) => id !== recordId);
  const [relatedEmails, meta] = await Promise.all([emailsForRecords(orgId, relatedIds), recordMeta(orgId, relatedIds)]);
  for (const rid of relatedIds) {
    const email = relatedEmails.get(rid);
    if (!email) continue;
    const m = meta.get(rid);
    if (!m) continue; // запись архивна/недоступна
    candidates.push({
      recordId: rid, objectKey: m.objectKey, objectName: m.objectName, displayName: m.displayName,
      email, source: 'related', relationLabel: relatedLabel.get(rid) ?? null,
    });
  }

  // дедуп по email (self раньше related в массиве → побеждает)
  const seen = new Set<string>();
  return candidates.filter((c) => {
    const key = c.email.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Резолвит ОДНОГО получателя для compose/send по вводу формы записи-КОНТЕКСТА.
 * Вход: { email?, name?, recordId? }.
 *
 * Безопасность (адверс CRIT-1/MED-4): получатель-по-recordId допускается ТОЛЬКО если запись входит в
 * whitelist резолвимых кандидатов записи-контекста (self или реально связанная) — иначе через произвольный
 * recordId можно было бы вытащить email из объекта, к которому нет прав (RBAC-обход), или подделать адрес.
 * Email при recordId берётся АВТОРИТЕТНО из кандидата (клиентский email игнорируется — анти-spoof).
 * Ручной email допускается ТОЛЬКО без recordId (single compose).
 */
export async function resolveSingleRecipient(
  orgId: string,
  contextRecordId: string,
  input: { email?: string | null; name?: string | null; recordId?: string | null }
): Promise<{ email: string; name: string | null; recordId: string | null } | null> {
  const manualName = (input.name ?? '').trim() || null;

  if (input.recordId) {
    const candidates = await resolveRecipients(orgId, contextRecordId);
    const c = candidates.find((x) => x.recordId === input.recordId);
    if (!c) return null; // не входит в whitelist кандидатов записи-контекста → не резолвится
    return { email: c.email, name: manualName ?? c.displayName, recordId: c.recordId };
  }

  // ручной ввод — только без recordId
  const rawEmail = (input.email ?? '').trim().toLowerCase();
  if (!rawEmail) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) return null;
  return { email: rawEmail, name: manualName, recordId: null };
}
