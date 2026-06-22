import { Router, Request, Response, NextFunction } from 'express';
import { AttributeAiType, AttributeType, Prisma, PrismaClient, RelationshipCardinality, Role } from '@prisma/client';
import { z } from 'zod';

import { authenticate, requireOrg } from '../middleware/auth';
import { assertAccess, buildResolver, meets } from '../services/permissions';
import { ensureReverseAttribute, isReverseRelationshipAttribute, archiveRelationshipForward } from '../services/crm/relationships';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate, requireOrg);

const keySchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9_-]*$/, 'Key must start with a lowercase letter and contain only lowercase letters, numbers, "_" or "-"');

const jsonObjectSchema = z.record(z.unknown());

const createObjectSchema = z.object({
  key: keySchema,
  singularName: z.string().min(1).max(80),
  pluralName: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  icon: z.string().max(80).optional(),
  color: z.string().max(40).optional(),
});

const attributeOptionSchema = z.object({
  value: z.string().min(1).max(120),
  label: z.string().min(1).max(120),
  color: z.string().max(40).optional(),
  order: z.number().int().min(0).optional(),
});

const relationshipSchema = z.object({
  targetObjectId: z.string().min(1).optional(),
  targetObjectKey: keySchema.optional(),
  cardinality: z.nativeEnum(RelationshipCardinality).optional(),
  isBidirectional: z.boolean().optional(),
  config: jsonObjectSchema.optional(),
});

// AI-атрибут (M2): поля, общие для create/update.
const aiFieldsSchema = {
  aiEnabled: z.boolean().optional(),
  aiType: z.nativeEnum(AttributeAiType).nullable().optional(),
  aiPrompt: z.string().max(4000).nullable().optional(),
  aiGuidance: z.string().max(4000).nullable().optional(),
  aiConfig: jsonObjectSchema.nullable().optional(),
};

const createAttributeSchema = z.object({
  key: keySchema,
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  type: z.nativeEnum(AttributeType),
  isRequired: z.boolean().optional(),
  isUnique: z.boolean().optional(),
  isPrimary: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
  config: jsonObjectSchema.optional(),
  options: z.array(attributeOptionSchema).optional(),
  relationship: relationshipSchema.optional(),
  ...aiFieldsSchema,
});

const updateObjectSchema = z.object({
  singularName: z.string().min(1).max(80).optional(),
  pluralName: z.string().min(1).max(80).optional(),
  description: z.string().max(500).nullable().optional(),
  icon: z.string().max(80).nullable().optional(),
  color: z.string().max(40).nullable().optional(),
  primaryAttributeId: z.string().optional(),
});

const updateAttributeSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  isRequired: z.boolean().optional(),
  isUnique: z.boolean().optional(),
  isPrimary: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
  config: jsonObjectSchema.nullable().optional(),
  ...aiFieldsSchema,
});

const updateOptionSchema = z.object({
  value: z.string().min(1).max(120).optional(),
  label: z.string().min(1).max(120).optional(),
  color: z.string().max(40).nullable().optional(),
  order: z.number().int().min(0).optional(),
});

function canManageCrm(req: Request): boolean {
  return req.user?.role === Role.OWNER || req.user?.role === Role.ADMIN;
}

function assertCanManageCrm(req: Request, res: Response): boolean {
  if (!canManageCrm(req)) {
    res.status(403).json({ error: 'Insufficient permissions' });
    return false;
  }

  return true;
}

function isSelectAttributeType(type: AttributeType): boolean {
  return type === AttributeType.SELECT || type === AttributeType.MULTI_SELECT;
}

// M25-1 (правка #2): strict-валидация AI-config на create/patch (несовместимый тип / без options / без
// prompt / outputType≠тип → 422 INVALID_AI_CONFIG). На run эта же проверка (services/ai) защищает повторно.
class AiConfigError extends Error {
  code = 'INVALID_AI_CONFIG';
  constructor(message: string) { super(message); this.name = 'AiConfigError'; }
}

function validateAiConfig(p: {
  aiEnabled?: boolean | null;
  aiType?: AttributeAiType | null;
  baseType: AttributeType;
  aiPrompt?: string | null;
  aiConfig?: Record<string, unknown> | null;
  optionCount: number;
}): void {
  if (!p.aiEnabled) return; // AI выключен — нечего валидировать
  // адверс MEDIUM-2: aiEnabled без aiType = несогласованное «AI-поле без типа» → 422, не silent skip
  if (!p.aiType) throw new AiConfigError('AI is enabled but no AI type is selected.');
  const t = p.baseType;
  const isText = t === AttributeType.TEXT || t === AttributeType.LONG_TEXT;
  switch (p.aiType) {
    case AttributeAiType.CLASSIFY:
      if (t !== AttributeType.SELECT && t !== AttributeType.MULTI_SELECT) throw new AiConfigError('Classify requires a Select or Multi-select attribute.');
      if (p.optionCount < 1) throw new AiConfigError('Classify requires at least one option to choose from.');
      break;
    case AttributeAiType.SUMMARIZE:
    case AttributeAiType.RESEARCH:
      if (!isText) throw new AiConfigError(`${p.aiType === AttributeAiType.SUMMARIZE ? 'Summarize' : 'Research'} requires a Text or Long-text attribute.`);
      break;
    case AttributeAiType.PROMPT: {
      if (t !== AttributeType.TEXT && t !== AttributeType.LONG_TEXT && t !== AttributeType.NUMBER && t !== AttributeType.CURRENCY) {
        throw new AiConfigError('Prompt completion requires a Text, Number or Currency attribute.');
      }
      const prompt = p.aiPrompt ?? (typeof p.aiConfig?.promptTemplate === 'string' ? (p.aiConfig.promptTemplate as string) : '');
      if (!prompt || !String(prompt).trim()) throw new AiConfigError('Prompt completion requires a prompt.');
      const out = p.aiConfig?.outputType;
      if (typeof out === 'string') {
        const compat: Record<string, AttributeType[]> = {
          TEXT: [AttributeType.TEXT, AttributeType.LONG_TEXT],
          NUMBER: [AttributeType.NUMBER],
          CURRENCY: [AttributeType.CURRENCY],
        };
        if (compat[out] && !compat[out].includes(t)) throw new AiConfigError(`Prompt outputType "${out}" doesn't match the attribute type.`);
      }
      break;
    }
  }
}

function handleAiConfigError(err: unknown, res: Response): boolean {
  if (err instanceof AiConfigError) { res.status(422).json({ error: err.message, code: err.code }); return true; }
  return false;
}

// GET /api/objects
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;

    const objects = await prisma.object.findMany({
      where: {
        orgId,
        archivedAt: null,
      },
      include: {
        primaryAttribute: true,
        _count: {
          select: {
            // считаем только АКТИВНЫЕ атрибуты — единый источник истины с detail-экраном
            attributes: { where: { isArchived: false, archivedAt: null } },
            records: true,
            views: true,
            lists: true,
          },
        },
      },
      orderBy: [{ isSystem: 'desc' }, { pluralName: 'asc' }],
    });

    // RBAC: скрываем объекты с уровнем NONE (S355 — No access не виден в сайдбаре)
    const resolver = await buildResolver(orgId, { userId: req.user!.userId, role: req.user!.role }, 'OBJECT');
    res.json({ objects: objects.filter((o) => meets(resolver(o.id), 'READ')) });
  } catch (err) {
    next(err);
  }
});

// GET /api/objects/:id/attributes
router.get('/:id/attributes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;

    const crmObject = await prisma.object.findFirst({
      where: {
        id: req.params.id,
        orgId,
        archivedAt: null,
      },
      select: { id: true },
    });

    if (!crmObject) {
      res.status(404).json({ error: 'Object not found' });
      return;
    }
    if (!(await assertAccess(req, res, 'OBJECT', 'READ', crmObject.id))) return;

    const attributes = await prisma.attribute.findMany({
      where: {
        objectId: crmObject.id,
        orgId,
        isArchived: false,
        archivedAt: null,
      },
      include: {
        options: {
          where: { isArchived: false },
          orderBy: { order: 'asc' },
        },
        sourceRelationshipDefinitions: {
          where: { archivedAt: null },
          include: {
            targetObject: true,
            reverseAttribute: true,
          },
        },
      },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });

    res.json({ attributes });
  } catch (err) {
    next(err);
  }
});

// POST /api/objects/:id/attributes
router.post('/:id/attributes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!assertCanManageCrm(req, res)) {
      return;
    }

    const orgId = req.user!.orgId!;
    const data = createAttributeSchema.parse(req.body);

    if (data.options && data.options.length > 0 && !isSelectAttributeType(data.type)) {
      res.status(400).json({ error: 'Options are allowed only for SELECT and MULTI_SELECT attributes' });
      return;
    }

    // M25-1: strict AI-config validation на создании
    validateAiConfig({ aiEnabled: data.aiEnabled, aiType: data.aiType, baseType: data.type, aiPrompt: data.aiPrompt, aiConfig: data.aiConfig as Record<string, unknown> | null, optionCount: data.options?.length ?? 0 });

    if (data.type === AttributeType.RELATIONSHIP) {
      const targetObjectId = data.relationship?.targetObjectId;
      const targetObjectKey = data.relationship?.targetObjectKey;

      if (!targetObjectId && !targetObjectKey) {
        res.status(400).json({ error: 'Relationship attribute requires targetObjectId or targetObjectKey' });
        return;
      }
    }

    const crmObject = await prisma.object.findFirst({
      where: {
        id: req.params.id,
        orgId,
        archivedAt: null,
      },
      select: { id: true },
    });

    if (!crmObject) {
      res.status(404).json({ error: 'Object not found' });
      return;
    }

    let relationshipTargetObjectId: string | null = null;

    if (data.type === AttributeType.RELATIONSHIP) {
      const targetObject = await prisma.object.findFirst({
        where: {
          orgId,
          archivedAt: null,
          ...(data.relationship?.targetObjectId
            ? { id: data.relationship.targetObjectId }
            : { key: data.relationship!.targetObjectKey! }),
        },
        select: { id: true },
      });

      if (!targetObject) {
        res.status(400).json({ error: 'Relationship target object not found' });
        return;
      }

      relationshipTargetObjectId = targetObject.id;
    }

    const attributeId = await prisma.$transaction(async (tx) => {
      if (data.isPrimary) {
        await tx.attribute.updateMany({
          where: {
            objectId: crmObject.id,
            orgId,
            isPrimary: true,
          },
          data: { isPrimary: false },
        });
      }

      const createData: Prisma.AttributeUncheckedCreateInput = {
        orgId,
        objectId: crmObject.id,
        key: data.key,
        name: data.name,
        description: data.description ?? null,
        type: data.type,
        isSystem: false,
        isRequired: data.isRequired ?? false,
        isUnique: data.isUnique ?? false,
        isPrimary: data.isPrimary ?? false,
        order: data.order ?? 0,
      };

      if (data.config !== undefined) {
        createData.config = data.config as Prisma.InputJsonValue;
      }

      // AI-атрибут (M2): включение, тип и параметры генерации.
      if (data.aiEnabled !== undefined) createData.aiEnabled = data.aiEnabled;
      if (data.aiType !== undefined) createData.aiType = data.aiType ?? null;
      if (data.aiPrompt !== undefined) createData.aiPrompt = data.aiPrompt ?? null;
      if (data.aiGuidance !== undefined) createData.aiGuidance = data.aiGuidance ?? null;
      if (data.aiConfig !== undefined) {
        createData.aiConfig =
          data.aiConfig === null ? Prisma.JsonNull : (data.aiConfig as Prisma.InputJsonValue);
      }

      const attribute = await tx.attribute.create({
        data: createData,
      });

      if (data.isPrimary) {
        await tx.object.update({
          where: { id: crmObject.id },
          data: { primaryAttributeId: attribute.id },
        });
      }

      if (data.options && data.options.length > 0) {
        for (let index = 0; index < data.options.length; index += 1) {
          const option = data.options[index];

          await tx.attributeOption.create({
            data: {
              orgId,
              attributeId: attribute.id,
              value: option.value,
              label: option.label,
              color: option.color ?? null,
              order: option.order ?? index,
            },
          });
        }
      }

      if (data.type === AttributeType.RELATIONSHIP && relationshipTargetObjectId) {
        const relationshipCreateData: Prisma.RelationshipDefinitionUncheckedCreateInput = {
          orgId,
          sourceObjectId: crmObject.id,
          sourceAttributeId: attribute.id,
          targetObjectId: relationshipTargetObjectId,
          cardinality: data.relationship?.cardinality ?? RelationshipCardinality.MANY_TO_MANY,
          isBidirectional: data.relationship?.isBidirectional ?? true,
        };

        if (data.relationship?.config !== undefined) {
          relationshipCreateData.config = data.relationship.config as Prisma.InputJsonValue;
        }

        await tx.relationshipDefinition.create({
          data: relationshipCreateData,
        });
      }

      return attribute.id;
    });

    // REL-1: reverse-атрибут создаём ПОСЛЕ коммита (отдельная tx) — P2002 на гонке не отравит основную транзакцию
    if (data.type === AttributeType.RELATIONSHIP && relationshipTargetObjectId) {
      const newDef = await prisma.relationshipDefinition.findFirst({ where: { sourceAttributeId: attributeId, orgId, archivedAt: null }, select: { id: true } });
      if (newDef) await prisma.$transaction((tx) => ensureReverseAttribute(tx, orgId, newDef.id)).catch(() => { /* reverse — best-effort, не валим create */ });
    }

    const createdAttribute = await prisma.attribute.findFirst({
      where: {
        id: attributeId,
        orgId,
      },
      include: {
        options: {
          where: { isArchived: false },
          orderBy: { order: 'asc' },
        },
        sourceRelationshipDefinitions: {
          where: { archivedAt: null },
          include: {
            targetObject: true,
            reverseAttribute: true,
          },
        },
      },
    });

    res.status(201).json(createdAttribute);
  } catch (err) {
    if (handleAiConfigError(err, res)) return;
    next(err);
  }
});

// PATCH /api/objects/:id
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!assertCanManageCrm(req, res)) {
      return;
    }

    const orgId = req.user!.orgId!;
    const data = updateObjectSchema.parse(req.body);

    const existing = await prisma.object.findFirst({
      where: { id: req.params.id, orgId, archivedAt: null },
      select: { id: true, isSystem: true },
    });

    if (!existing) {
      res.status(404).json({ error: 'Object not found' });
      return;
    }

    // Проверяем primaryAttributeId если передан
    if (data.primaryAttributeId) {
      const attr = await prisma.attribute.findFirst({
        where: { id: data.primaryAttributeId, objectId: existing.id, orgId, isArchived: false },
        select: { id: true },
      });
      if (!attr) {
        res.status(400).json({ error: 'Primary attribute not found on this object' });
        return;
      }
    }

    const updated = await prisma.object.update({
      where: { id: existing.id },
      data: {
        ...(data.singularName !== undefined && { singularName: data.singularName }),
        ...(data.pluralName !== undefined && { pluralName: data.pluralName }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.icon !== undefined && { icon: data.icon }),
        ...(data.color !== undefined && { color: data.color }),
        ...(data.primaryAttributeId !== undefined && { primaryAttributeId: data.primaryAttributeId }),
      },
      include: {
        primaryAttribute: true,
        _count: { select: { attributes: true, records: true, views: true, lists: true } },
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/objects/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // RBAC: удаление объекта = управление сущностью → FULL (managers bypass).
    if (!(await assertAccess(req, res, 'OBJECT', 'FULL', req.params.id))) return;

    const orgId = req.user!.orgId!;

    const existing = await prisma.object.findFirst({
      where: { id: req.params.id, orgId, archivedAt: null },
      select: { id: true, isSystem: true },
    });

    if (!existing) {
      res.status(404).json({ error: 'Object not found' });
      return;
    }

    if (existing.isSystem) {
      res.status(400).json({ error: 'System objects cannot be archived' });
      return;
    }

    await prisma.object.update({
      where: { id: existing.id },
      data: { archivedAt: new Date() },
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// PATCH /api/objects/:objectId/attributes/:attributeId
router.patch('/:objectId/attributes/:attributeId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!assertCanManageCrm(req, res)) {
      return;
    }

    const orgId = req.user!.orgId!;
    const data = updateAttributeSchema.parse(req.body);

    const crmObject = await prisma.object.findFirst({
      where: { id: req.params.objectId, orgId, archivedAt: null },
      select: { id: true },
    });

    if (!crmObject) {
      res.status(404).json({ error: 'Object not found' });
      return;
    }

    const attribute = await prisma.attribute.findFirst({
      where: { id: req.params.attributeId, objectId: crmObject.id, orgId, isArchived: false },
      select: { id: true, isPrimary: true, isSystem: true, type: true, aiEnabled: true, aiType: true, aiPrompt: true, aiConfig: true, _count: { select: { options: { where: { isArchived: false } } } } },
    });

    if (!attribute) {
      res.status(404).json({ error: 'Attribute not found' });
      return;
    }

    // M25-1: strict AI-config validation на patch — по ЭФФЕКТИВНЫМ значениям (data ?? existing)
    validateAiConfig({
      aiEnabled: data.aiEnabled !== undefined ? data.aiEnabled : attribute.aiEnabled,
      aiType: data.aiType !== undefined ? data.aiType : attribute.aiType,
      baseType: attribute.type,
      aiPrompt: data.aiPrompt !== undefined ? data.aiPrompt : attribute.aiPrompt,
      aiConfig: (data.aiConfig !== undefined ? data.aiConfig : attribute.aiConfig) as Record<string, unknown> | null,
      optionCount: attribute._count.options,
    });

    // Если устанавливаем isPrimary — снимаем флаг с текущего первичного
    if (data.isPrimary) {
      await prisma.$transaction([
        prisma.attribute.updateMany({
          where: { objectId: crmObject.id, orgId, isPrimary: true },
          data: { isPrimary: false },
        }),
        prisma.attribute.update({
          where: { id: attribute.id },
          data: { isPrimary: true },
        }),
        prisma.object.update({
          where: { id: crmObject.id },
          data: { primaryAttributeId: attribute.id },
        }),
      ]);
    }

    const updateData: Prisma.AttributeUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.isRequired !== undefined) updateData.isRequired = data.isRequired;
    if (data.isUnique !== undefined) updateData.isUnique = data.isUnique;
    if (data.order !== undefined) updateData.order = data.order;
    if (data.config !== undefined) updateData.config = (data.config ?? Prisma.JsonNull) as Prisma.InputJsonValue;
    if (data.isPrimary !== undefined) updateData.isPrimary = data.isPrimary;

    // AI-атрибут (M2)
    if (data.aiEnabled !== undefined) updateData.aiEnabled = data.aiEnabled;
    if (data.aiType !== undefined) updateData.aiType = data.aiType ?? null;
    if (data.aiPrompt !== undefined) updateData.aiPrompt = data.aiPrompt ?? null;
    if (data.aiGuidance !== undefined) updateData.aiGuidance = data.aiGuidance ?? null;
    if (data.aiConfig !== undefined)
      updateData.aiConfig = (data.aiConfig ?? Prisma.JsonNull) as Prisma.InputJsonValue;

    const updated = await prisma.attribute.update({
      where: { id: attribute.id },
      data: updateData,
      include: {
        options: { where: { isArchived: false }, orderBy: { order: 'asc' } },
        sourceRelationshipDefinitions: {
          where: { archivedAt: null },
          include: { targetObject: true, reverseAttribute: true },
        },
      },
    });

    res.json(updated);
  } catch (err) {
    if (handleAiConfigError(err, res)) return;
    next(err);
  }
});

// DELETE /api/objects/:objectId/attributes/:attributeId
router.delete('/:objectId/attributes/:attributeId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!assertCanManageCrm(req, res)) {
      return;
    }

    const orgId = req.user!.orgId!;

    const crmObject = await prisma.object.findFirst({
      where: { id: req.params.objectId, orgId, archivedAt: null },
      select: { id: true },
    });

    if (!crmObject) {
      res.status(404).json({ error: 'Object not found' });
      return;
    }

    const attribute = await prisma.attribute.findFirst({
      where: { id: req.params.attributeId, objectId: crmObject.id, orgId, isArchived: false },
      select: { id: true, isSystem: true, isPrimary: true, type: true },
    });

    if (!attribute) {
      res.status(404).json({ error: 'Attribute not found' });
      return;
    }

    // REL-1: reverse-атрибут управляется forward-стороной — прямой archive запрещён.
    if (await isReverseRelationshipAttribute(prisma, attribute.id)) {
      res.status(403).json({ error: 'This is a managed reverse relationship field — archive the source relationship instead', code: 'REVERSE_ATTRIBUTE_MANAGED' });
      return;
    }

    if (attribute.isPrimary) {
      res.status(400).json({ error: 'Cannot archive the primary attribute' });
      return;
    }

    // системные атрибуты (вкл. системные forward-связи company/workspace) защищены — проверяем ДО каскада
    if (attribute.isSystem) {
      res.status(400).json({ error: 'System attributes cannot be archived' });
      return;
    }

    // REL-1: НЕсистемный forward relationship-атрибут → архивируем вместе с reverse-атрибутом и определением (одна tx).
    const forwardDef = attribute.type === AttributeType.RELATIONSHIP
      ? await prisma.relationshipDefinition.findFirst({ where: { sourceAttributeId: attribute.id, orgId, archivedAt: null }, select: { id: true } })
      : null;
    if (forwardDef) {
      await prisma.$transaction((tx) => archiveRelationshipForward(tx, orgId, attribute.id));
      res.status(204).send();
      return;
    }

    await prisma.attribute.update({
      where: { id: attribute.id },
      data: { isArchived: true, archivedAt: new Date() },
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// POST /api/objects/:objectId/attributes/:attributeId/options
router.post('/:objectId/attributes/:attributeId/options', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!assertCanManageCrm(req, res)) {
      return;
    }

    const orgId = req.user!.orgId!;
    const data = attributeOptionSchema.parse(req.body);

    const crmObject = await prisma.object.findFirst({
      where: { id: req.params.objectId, orgId, archivedAt: null },
      select: { id: true },
    });

    if (!crmObject) {
      res.status(404).json({ error: 'Object not found' });
      return;
    }

    const attribute = await prisma.attribute.findFirst({
      where: { id: req.params.attributeId, objectId: crmObject.id, orgId, isArchived: false },
      select: { id: true, type: true },
    });

    if (!attribute) {
      res.status(404).json({ error: 'Attribute not found' });
      return;
    }

    if (!isSelectAttributeType(attribute.type)) {
      res.status(400).json({ error: 'Options are only allowed on SELECT and MULTI_SELECT attributes' });
      return;
    }

    const maxOrderResult = await prisma.attributeOption.findFirst({
      where: { attributeId: attribute.id, isArchived: false },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const nextOrder = data.order ?? ((maxOrderResult?.order ?? -1) + 1);

    const option = await prisma.attributeOption.create({
      data: {
        orgId,
        attributeId: attribute.id,
        value: data.value,
        label: data.label,
        color: data.color ?? null,
        order: nextOrder,
      },
    });

    res.status(201).json(option);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/objects/:objectId/attributes/:attributeId/options/:optionId
router.patch('/:objectId/attributes/:attributeId/options/:optionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!assertCanManageCrm(req, res)) {
      return;
    }

    const orgId = req.user!.orgId!;
    const data = updateOptionSchema.parse(req.body);

    const option = await prisma.attributeOption.findFirst({
      where: {
        id: req.params.optionId,
        attributeId: req.params.attributeId,
        orgId,
        isArchived: false,
      },
      select: { id: true },
    });

    if (!option) {
      res.status(404).json({ error: 'Option not found' });
      return;
    }

    const updated = await prisma.attributeOption.update({
      where: { id: option.id },
      data: {
        ...(data.value !== undefined && { value: data.value }),
        ...(data.label !== undefined && { label: data.label }),
        ...(data.color !== undefined && { color: data.color }),
        ...(data.order !== undefined && { order: data.order }),
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/objects/:objectId/attributes/:attributeId/options/:optionId
router.delete('/:objectId/attributes/:attributeId/options/:optionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!assertCanManageCrm(req, res)) {
      return;
    }

    const orgId = req.user!.orgId!;

    const option = await prisma.attributeOption.findFirst({
      where: {
        id: req.params.optionId,
        attributeId: req.params.attributeId,
        orgId,
        isArchived: false,
      },
      select: { id: true },
    });

    if (!option) {
      res.status(404).json({ error: 'Option not found' });
      return;
    }

    await prisma.attributeOption.update({
      where: { id: option.id },
      data: { isArchived: true },
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// GET /api/objects/:idOrKey
router.get('/:idOrKey', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const idOrKey = req.params.idOrKey;

    const crmObject = await prisma.object.findFirst({
      where: {
        orgId,
        archivedAt: null,
        OR: [{ id: idOrKey }, { key: idOrKey }],
      },
      include: {
        primaryAttribute: true,
        attributes: {
          where: {
            isArchived: false,
            archivedAt: null,
          },
          include: {
            options: {
              where: { isArchived: false },
              orderBy: { order: 'asc' },
            },
            sourceRelationshipDefinitions: {
              where: { archivedAt: null },
              include: {
                targetObject: true,
                reverseAttribute: true,
              },
            },
          },
          orderBy: [{ order: 'asc' }, { name: 'asc' }],
        },
        views: {
          where: {
            archivedAt: null,
          },
          include: {
            columns: {
              include: {
                attribute: true,
              },
              orderBy: { order: 'asc' },
            },
            filters: {
              include: {
                attribute: true,
              },
              orderBy: { order: 'asc' },
            },
            sorts: {
              include: {
                attribute: true,
              },
              orderBy: { order: 'asc' },
            },
          },
          orderBy: [{ isDefault: 'desc' }, { order: 'asc' }, { name: 'asc' }],
        },
        _count: {
          select: {
            records: true,
            lists: true,
          },
        },
      },
    });

    if (!crmObject) {
      res.status(404).json({ error: 'Object not found' });
      return;
    }
    if (!(await assertAccess(req, res, 'OBJECT', 'READ', crmObject.id))) return;

    // Прокидываем цель связи в config атрибута, чтобы фронт-пикер знал, по какому объекту искать.
    for (const attr of crmObject.attributes as any[]) {
      if (attr.type === 'RELATIONSHIP') {
        const def = attr.sourceRelationshipDefinitions?.[0];
        if (def?.targetObject) {
          attr.config = { ...(attr.config ?? {}), targetObjectKey: def.targetObject.key, targetObjectId: def.targetObjectId, cardinality: def.cardinality };
        }
      }
    }

    res.json(crmObject);
  } catch (err) {
    next(err);
  }
});

// POST /api/objects
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!assertCanManageCrm(req, res)) {
      return;
    }

    const orgId = req.user!.orgId!;
    const data = createObjectSchema.parse(req.body);

    // Создаём объект + первичный атрибут "Name" (как в Attio: новый объект сразу пригоден к записям).
    const objectId = await prisma.$transaction(async (tx) => {
      const obj = await tx.object.create({
        data: {
          orgId,
          key: data.key,
          singularName: data.singularName,
          pluralName: data.pluralName,
          description: data.description ?? null,
          icon: data.icon ?? null,
          color: data.color ?? null,
          isSystem: false,
          createdById: req.user!.userId,
        },
      });

      const nameAttr = await tx.attribute.create({
        data: {
          orgId,
          objectId: obj.id,
          key: 'name',
          name: 'Name',
          type: AttributeType.TEXT,
          isSystem: false,
          isPrimary: true,
          isRequired: true,
          order: 0,
        },
      });

      await tx.object.update({
        where: { id: obj.id },
        data: { primaryAttributeId: nameAttr.id },
      });

      return obj.id;
    });

    const crmObject = await prisma.object.findFirst({
      where: { id: objectId, orgId },
      include: {
        primaryAttribute: true,
        attributes: {
          where: { isArchived: false, archivedAt: null },
          orderBy: [{ order: 'asc' }, { name: 'asc' }],
        },
        _count: {
          select: {
            attributes: { where: { isArchived: false, archivedAt: null } },
            records: true,
            views: true,
            lists: true,
          },
        },
      },
    });

    res.status(201).json(crmObject);
  } catch (err) {
    next(err);
  }
});

export default router;