/**
 * REL-1 — жизненный цикл ОБРАТНОЙ стороны связи (reverse relationship attribute).
 *
 * Reverse-сторона = НЕ второй движок связей, а проекция тех же RelationshipValue.
 * Для bidirectional RelationshipDefinition на target-объекте заводится СИСТЕМНЫЙ атрибут
 * (isSystem=true, type RELATIONSHIP), на который ссылается RelationshipDefinition.reverseAttributeId.
 * У reverse-атрибута НЕТ собственного RelationshipDefinition — он только reverseAttributeId чужого.
 *
 * Инварианты (правки GPT):
 *  • единый helper isReverseRelationshipAttribute (через reverseRelationshipDefinitions back-relation);
 *  • reverse-атрибут НЕЛЬЗЯ писать напрямую (guard в writeValues) и архивировать напрямую (403);
 *  • archive forward → archive reverse + definition в ОДНОЙ транзакции;
 *  • backfill идемпотентен/race-safe (повтор не плодит второй reverse и не меняет корректный reverseAttributeId).
 */
import { Prisma, PrismaClient, RelationshipCardinality, AttributeType } from '@prisma/client';

const prisma = new PrismaClient();
type Tx = Prisma.TransactionClient;

// Инверсия кардинальности для обратной стороны (ONE_TO_ONE / MANY_TO_MANY симметричны).
export function inverseCardinality(c: RelationshipCardinality): RelationshipCardinality {
  if (c === RelationshipCardinality.ONE_TO_MANY) return RelationshipCardinality.MANY_TO_ONE;
  if (c === RelationshipCardinality.MANY_TO_ONE) return RelationshipCardinality.ONE_TO_MANY;
  return c;
}

// reverse-атрибут ⇔ на него указывает живой RelationshipDefinition.reverseAttributeId.
export async function isReverseRelationshipAttribute(tx: Tx | PrismaClient, attributeId: string): Promise<boolean> {
  const def = await tx.relationshipDefinition.findFirst({ where: { reverseAttributeId: attributeId, archivedAt: null }, select: { id: true } });
  return def != null;
}

// Уникальный key reverse-атрибута на target-объекте: предпочтительно key source-объекта (companies.deals),
// при коллизии с другим атрибутом — суффикс forward-ключа.
async function pickReverseKey(tx: Tx, targetObjectId: string, preferred: string, forwardKey: string): Promise<string> {
  const taken = async (k: string): Promise<boolean> =>
    (await tx.attribute.findUnique({ where: { objectId_key: { objectId: targetObjectId, key: k } }, select: { id: true } })) != null;
  if (!(await taken(preferred))) return preferred;
  const alt = `${preferred}_${forwardKey}`;
  if (!(await taken(alt))) return alt;
  return `${preferred}_${forwardKey}_rev`;
}

/**
 * Обеспечить reverse-атрибут для прямого определения. Идемпотентно (живой reverse → no-op),
 * race-safe (P2002 на objectId_key → переиспользовать существующий). Возвращает {attributeId, created}.
 * Для не-bidirectional определений → {null,false}.
 */
export async function ensureReverseAttribute(tx: Tx, orgId: string, definitionId: string): Promise<{ attributeId: string | null; created: boolean }> {
  const def = await tx.relationshipDefinition.findFirst({
    where: { id: definitionId, orgId, archivedAt: null },
    include: {
      sourceObject: { select: { id: true, key: true, singularName: true, pluralName: true } },
      sourceAttribute: { select: { id: true, key: true, name: true } },
    },
  });
  if (!def || !def.isBidirectional) return { attributeId: null, created: false };

  // уже привязан reverse: живой → no-op; архивный (живой def указывает на архивный reverse) → un-archive, не плодить новый
  if (def.reverseAttributeId) {
    const cur = await tx.attribute.findUnique({ where: { id: def.reverseAttributeId }, select: { id: true, isArchived: true } });
    if (cur && !cur.isArchived) return { attributeId: cur.id, created: false };
    if (cur && cur.isArchived) {
      await tx.attribute.update({ where: { id: cur.id }, data: { isArchived: false, archivedAt: null } });
      return { attributeId: cur.id, created: false };
    }
    // reverseAttributeId указывает в никуда (битая ссылка) → пере-создаём ниже
  }

  const targetObjectId = def.targetObjectId;
  const key = await pickReverseKey(tx, targetObjectId, def.sourceObject.key, def.sourceAttribute.key);
  const maxOrder = await tx.attribute.findFirst({ where: { objectId: targetObjectId }, orderBy: { order: 'desc' }, select: { order: true } });
  const config: Prisma.InputJsonValue = {
    reverse: true,
    reverseOfAttributeId: def.sourceAttribute.id,
    reverseOf: `${def.sourceObject.key}.${def.sourceAttribute.key}`,
    reverseOfLabel: `${def.sourceObject.singularName}.${def.sourceAttribute.name}`,
    targetObjectKey: def.sourceObject.key,
    cardinality: inverseCardinality(def.cardinality),
  };

  let reverseId: string;
  let created = false;
  try {
    const reverse = await tx.attribute.create({
      data: {
        orgId, objectId: targetObjectId, key, name: def.sourceObject.pluralName,
        type: AttributeType.RELATIONSHIP, isSystem: true, order: (maxOrder?.order ?? -1) + 1,
        config,
      },
      select: { id: true },
    });
    reverseId = reverse.id;
    created = true;
  } catch (e) {
    // гонка: другой воркер уже создал атрибут с этим key → переиспользуем
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const existing = await tx.attribute.findUnique({ where: { objectId_key: { objectId: targetObjectId, key } }, select: { id: true } });
      if (!existing) throw e;
      reverseId = existing.id;
    } else { throw e; }
  }

  // привязать reverseAttributeId, только если ещё не привязан (updateMany WHERE null — row-lock сериализует гонку)
  await tx.relationshipDefinition.updateMany({ where: { id: def.id, reverseAttributeId: null }, data: { reverseAttributeId: reverseId } });
  // race-safe: если параллельный запуск уже привязал ДРУГОЙ reverse (дивергентный key), наш — проигравший orphan → удаляем
  const after = await tx.relationshipDefinition.findUnique({ where: { id: def.id }, select: { reverseAttributeId: true } });
  if (after?.reverseAttributeId && after.reverseAttributeId !== reverseId) {
    if (created) await tx.attribute.delete({ where: { id: reverseId } }).catch(() => {});
    return { attributeId: after.reverseAttributeId, created: false };
  }
  return { attributeId: reverseId, created };
}

/**
 * Архивировать ПРЯМОЙ relationship-атрибут вместе с reverse-атрибутом и определением (одна транзакция).
 * Вызывается из archive-роута, когда атрибут — forward-сторона связи.
 */
export async function archiveRelationshipForward(tx: Tx, orgId: string, forwardAttributeId: string): Promise<void> {
  const now = new Date();
  const def = await tx.relationshipDefinition.findFirst({
    where: { sourceAttributeId: forwardAttributeId, orgId, archivedAt: null },
    select: { id: true, reverseAttributeId: true },
  });
  await tx.attribute.updateMany({ where: { id: forwardAttributeId, orgId }, data: { isArchived: true, archivedAt: now } });
  if (def) {
    if (def.reverseAttributeId) {
      await tx.attribute.updateMany({ where: { id: def.reverseAttributeId, isArchived: false }, data: { isArchived: true, archivedAt: now } });
    }
    await tx.relationshipDefinition.update({ where: { id: def.id }, data: { archivedAt: now } });
  }
}

/**
 * Backfill reverse-атрибутов для ВСЕХ живых bidirectional-определений без живого reverse.
 * Идемпотентно/race-safe: повтор не создаёт второй reverse. Возвращает {created, scanned}.
 */
export async function backfillReverseAttributes(orgId?: string): Promise<{ created: number; scanned: number; failed: number }> {
  const defs = await prisma.relationshipDefinition.findMany({
    where: { archivedAt: null, isBidirectional: true, ...(orgId ? { orgId } : {}) },
    select: { id: true, orgId: true, reverseAttributeId: true },
  });
  let created = 0;
  let failed = 0;
  for (const d of defs) {
    if (d.reverseAttributeId) {
      const live = await prisma.attribute.findFirst({ where: { id: d.reverseAttributeId, isArchived: false }, select: { id: true } });
      if (live) continue;
    }
    try {
      const r = await prisma.$transaction((tx) => ensureReverseAttribute(tx, d.orgId, d.id));
      if (r.created) created += 1;
    } catch (e) {
      // гонку (P2002) глотаем — другой воркер создал; прочие ошибки считаем, но не валим весь backfill
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) failed += 1;
    }
  }
  return { created, scanned: defs.length, failed };
}
