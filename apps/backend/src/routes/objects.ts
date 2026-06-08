import { Router, Request, Response, NextFunction } from 'express';
import { AttributeType, Prisma, PrismaClient, RelationshipCardinality, Role } from '@prisma/client';
import { z } from 'zod';

import { authenticate, requireOrg } from '../middleware/auth';

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
            attributes: true,
            records: true,
            views: true,
            lists: true,
          },
        },
      },
      orderBy: [{ isSystem: 'desc' }, { pluralName: 'asc' }],
    });

    res.json({ objects });
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

    const crmObject = await prisma.object.create({
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
      include: {
        primaryAttribute: true,
        attributes: true,
        _count: {
          select: {
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