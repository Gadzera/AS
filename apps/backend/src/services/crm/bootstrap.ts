import {
  AttributeType,
  Prisma,
  PrismaClient,
  RelationshipCardinality,
  ViewScope,
  ViewType,
} from '@prisma/client';
import { backfillReverseAttributes } from './relationships';

const prisma = new PrismaClient();

type AttributeOptionSpec = {
  value: string;
  label: string;
  color?: string;
  order?: number;
};

type RelationshipSpec = {
  targetObjectKey: string;
  cardinality: RelationshipCardinality;
  isBidirectional?: boolean;
  config?: Prisma.InputJsonValue;
};

type AttributeSpec = {
  key: string;
  name: string;
  description?: string;
  type: AttributeType;
  isRequired?: boolean;
  isUnique?: boolean;
  isPrimary?: boolean;
  order: number;
  config?: Prisma.InputJsonValue;
  options?: AttributeOptionSpec[];
  relationship?: RelationshipSpec;
};

type ObjectSpec = {
  key: string;
  singularName: string;
  pluralName: string;
  description?: string;
  icon?: string;
  color?: string;
  attributes: AttributeSpec[];
  defaultViewAttributeKeys: string[];
};

type EnsuredOptionResult = {
  value: string;
  id: string;
  created: boolean;
};

type EnsuredAttributeResult = {
  key: string;
  id: string;
  created: boolean;
  options: EnsuredOptionResult[];
  relationshipDefinitionId: string | null;
};

type EnsuredViewResult = {
  id: string;
  name: string;
  created: boolean;
};

type EnsuredObjectResult = {
  key: string;
  id: string;
  created: boolean;
  attributes: EnsuredAttributeResult[];
  view: EnsuredViewResult | null;
};

export type CrmBootstrapResult = {
  orgId: string;
  created: boolean;
  objects: EnsuredObjectResult[];
};

const STANDARD_OBJECT_SPECS: ObjectSpec[] = [
  {
    key: 'companies',
    singularName: 'Company',
    pluralName: 'Companies',
    description: 'Companies and accounts your team works with.',
    icon: 'building-2',
    color: 'blue',
    defaultViewAttributeKeys: [
      'name',
      'domain',
      'categories',
      'employeeRange',
      'estimatedArr',
      'location',
    ],
    attributes: [
      {
        key: 'name',
        name: 'Name',
        type: AttributeType.TEXT,
        isRequired: true,
        isPrimary: true,
        order: 0,
      },
      {
        key: 'domain',
        name: 'Domain',
        type: AttributeType.URL,
        isUnique: true,
        order: 1,
      },
      {
        key: 'description',
        name: 'Description',
        type: AttributeType.LONG_TEXT,
        order: 2,
      },
      {
        key: 'categories',
        name: 'Categories',
        type: AttributeType.MULTI_SELECT,
        order: 3,
        options: [
          { value: 'prospect', label: 'Prospect', color: 'blue', order: 0 },
          { value: 'customer', label: 'Customer', color: 'green', order: 1 },
          { value: 'partner', label: 'Partner', color: 'purple', order: 2 },
          { value: 'competitor', label: 'Competitor', color: 'red', order: 3 },
        ],
      },
      {
        key: 'employeeRange',
        name: 'Employee range',
        type: AttributeType.SELECT,
        order: 4,
        options: [
          { value: '1-10', label: '1-10', color: 'gray', order: 0 },
          { value: '11-50', label: '11-50', color: 'gray', order: 1 },
          { value: '51-200', label: '51-200', color: 'blue', order: 2 },
          { value: '201-500', label: '201-500', color: 'blue', order: 3 },
          { value: '501-1000', label: '501-1000', color: 'purple', order: 4 },
          { value: '1001+', label: '1001+', color: 'purple', order: 5 },
        ],
      },
      {
        key: 'estimatedArr',
        name: 'Estimated ARR',
        type: AttributeType.CURRENCY,
        order: 5,
        config: { defaultCurrencyCode: 'USD' },
      },
      {
        key: 'location',
        name: 'Location',
        type: AttributeType.TEXT,
        order: 6,
      },
    ],
  },
  {
    key: 'people',
    singularName: 'Person',
    pluralName: 'People',
    description: 'People and contacts inside companies.',
    icon: 'users',
    color: 'green',
    defaultViewAttributeKeys: ['name', 'email', 'title', 'company', 'linkedin'],
    attributes: [
      {
        key: 'name',
        name: 'Name',
        type: AttributeType.TEXT,
        isRequired: true,
        isPrimary: true,
        order: 0,
      },
      {
        key: 'email',
        name: 'Email',
        type: AttributeType.EMAIL,
        isUnique: true,
        order: 1,
      },
      {
        key: 'title',
        name: 'Title',
        type: AttributeType.TEXT,
        order: 2,
      },
      {
        key: 'company',
        name: 'Company',
        type: AttributeType.RELATIONSHIP,
        order: 3,
        relationship: {
          targetObjectKey: 'companies',
          cardinality: RelationshipCardinality.MANY_TO_ONE,
          isBidirectional: true,
        },
      },
      {
        key: 'linkedin',
        name: 'LinkedIn',
        type: AttributeType.URL,
        order: 4,
      },
    ],
  },
  {
    key: 'deals',
    singularName: 'Deal',
    pluralName: 'Deals',
    description: 'Deals and opportunities in the pipeline.',
    icon: 'handshake',
    color: 'orange',
    defaultViewAttributeKeys: ['name', 'value', 'stage', 'company', 'owner'],
    attributes: [
      {
        key: 'name',
        name: 'Name',
        type: AttributeType.TEXT,
        isRequired: true,
        isPrimary: true,
        order: 0,
      },
      {
        key: 'value',
        name: 'Value',
        type: AttributeType.CURRENCY,
        order: 1,
        config: { defaultCurrencyCode: 'USD' },
      },
      {
        key: 'stage',
        name: 'Stage',
        type: AttributeType.SELECT,
        order: 2,
        options: [
          { value: 'lead', label: 'Lead', color: 'gray', order: 0 },
          { value: 'contacted', label: 'Contacted', color: 'blue', order: 1 },
          { value: 'prospecting', label: 'Prospecting', color: 'purple', order: 2 },
          { value: 'qualification', label: 'Qualification', color: 'yellow', order: 3 },
          { value: 'meeting', label: 'Meeting', color: 'orange', order: 4 },
          { value: 'proposal', label: 'Proposal', color: 'green', order: 5 },
        ],
      },
      {
        key: 'company',
        name: 'Company',
        type: AttributeType.RELATIONSHIP,
        order: 3,
        relationship: {
          targetObjectKey: 'companies',
          cardinality: RelationshipCardinality.MANY_TO_ONE,
          isBidirectional: true,
        },
      },
      {
        key: 'owner',
        name: 'Owner',
        type: AttributeType.USER,
        order: 4,
      },
    ],
  },
  // Стандартный объект: рабочие пространства (воркспейсы)
  {
    key: 'workspaces',
    singularName: 'Workspace',
    pluralName: 'Workspaces',
    description: 'Workspaces and teams inside the organization.',
    icon: 'layout-grid',
    color: 'violet',
    defaultViewAttributeKeys: ['name', 'slug', 'plan', 'membersCount'],
    attributes: [
      {
        key: 'name',
        name: 'Name',
        type: AttributeType.TEXT,
        isRequired: true,
        isPrimary: true,
        order: 0,
      },
      {
        key: 'slug',
        name: 'Slug',
        type: AttributeType.TEXT,
        isUnique: true,
        order: 1,
      },
      {
        key: 'plan',
        name: 'Plan',
        type: AttributeType.SELECT,
        order: 2,
        options: [
          { value: 'free', label: 'Free', color: 'gray', order: 0 },
          { value: 'starter', label: 'Starter', color: 'blue', order: 1 },
          { value: 'pro', label: 'Pro', color: 'purple', order: 2 },
          { value: 'enterprise', label: 'Enterprise', color: 'orange', order: 3 },
        ],
      },
      {
        key: 'membersCount',
        name: 'Members count',
        type: AttributeType.NUMBER,
        order: 3,
      },
      {
        key: 'website',
        name: 'Website',
        type: AttributeType.URL,
        order: 4,
      },
    ],
  },
  // Стандартный объект: пользователи (участники CRM)
  {
    key: 'users',
    singularName: 'User',
    pluralName: 'Users',
    description: 'Users and members registered in the system.',
    icon: 'user-round',
    color: 'teal',
    defaultViewAttributeKeys: ['name', 'email', 'role', 'status'],
    attributes: [
      {
        key: 'name',
        name: 'Name',
        type: AttributeType.TEXT,
        isRequired: true,
        isPrimary: true,
        order: 0,
      },
      {
        key: 'email',
        name: 'Email',
        type: AttributeType.EMAIL,
        isUnique: true,
        isRequired: true,
        order: 1,
      },
      {
        key: 'role',
        name: 'Role',
        type: AttributeType.SELECT,
        order: 2,
        options: [
          { value: 'admin', label: 'Admin', color: 'red', order: 0 },
          { value: 'member', label: 'Member', color: 'blue', order: 1 },
          { value: 'viewer', label: 'Viewer', color: 'gray', order: 2 },
        ],
      },
      {
        key: 'status',
        name: 'Status',
        type: AttributeType.SELECT,
        order: 3,
        options: [
          { value: 'active', label: 'Active', color: 'green', order: 0 },
          { value: 'invited', label: 'Invited', color: 'yellow', order: 1 },
          { value: 'suspended', label: 'Suspended', color: 'gray', order: 2 },
        ],
      },
      {
        key: 'workspace',
        name: 'Workspace',
        type: AttributeType.RELATIONSHIP,
        order: 4,
        relationship: {
          targetObjectKey: 'workspaces',
          cardinality: RelationshipCardinality.MANY_TO_ONE,
          isBidirectional: true,
        },
      },
    ],
  },
];

function attributeMapKey(objectKey: string, attributeKey: string): string {
  return `${objectKey}:${attributeKey}`;
}

async function ensureAttributeOptions(
  tx: Prisma.TransactionClient,
  orgId: string,
  attributeId: string,
  options: AttributeOptionSpec[] | undefined
): Promise<EnsuredOptionResult[]> {
  const ensuredOptions: EnsuredOptionResult[] = [];

  if (!options || options.length === 0) {
    return ensuredOptions;
  }

  for (let index = 0; index < options.length; index += 1) {
    const option = options[index];
    const existing = await tx.attributeOption.findUnique({
      where: {
        attributeId_value: {
          attributeId,
          value: option.value,
        },
      },
    });

    if (existing) {
      const updated = await tx.attributeOption.update({
        where: { id: existing.id },
        data: {
          label: option.label,
          color: option.color ?? null,
          order: option.order ?? index,
          isArchived: false,
        },
      });

      ensuredOptions.push({
        value: updated.value,
        id: updated.id,
        created: false,
      });
      continue;
    }

    const created = await tx.attributeOption.create({
      data: {
        orgId,
        attributeId,
        value: option.value,
        label: option.label,
        color: option.color ?? null,
        order: option.order ?? index,
      },
    });

    ensuredOptions.push({
      value: created.value,
      id: created.id,
      created: true,
    });
  }

  return ensuredOptions;
}

async function ensureRelationshipDefinition(
  tx: Prisma.TransactionClient,
  orgId: string,
  sourceObjectId: string,
  sourceAttributeId: string,
  targetObjectId: string,
  relationship: RelationshipSpec
): Promise<{ id: string; created: boolean }> {
  const existing = await tx.relationshipDefinition.findUnique({
    where: { sourceAttributeId },
  });

  if (existing) {
    const updateData: Prisma.RelationshipDefinitionUncheckedUpdateInput = {
      sourceObjectId,
      targetObjectId,
      cardinality: relationship.cardinality,
      isBidirectional: relationship.isBidirectional ?? true,
      archivedAt: null,
    };

    if (relationship.config !== undefined) {
      updateData.config = relationship.config;
    }

    const updated = await tx.relationshipDefinition.update({
      where: { id: existing.id },
      data: updateData,
    });

    return { id: updated.id, created: false };
  }

  const createData: Prisma.RelationshipDefinitionUncheckedCreateInput = {
    orgId,
    sourceObjectId,
    sourceAttributeId,
    targetObjectId,
    cardinality: relationship.cardinality,
    isBidirectional: relationship.isBidirectional ?? true,
  };

  if (relationship.config !== undefined) {
    createData.config = relationship.config;
  }

  const created = await tx.relationshipDefinition.create({
    data: createData,
  });

  return { id: created.id, created: true };
}

async function ensureDefaultView(
  tx: Prisma.TransactionClient,
  orgId: string,
  objectId: string,
  objectSpec: ObjectSpec,
  attributesByKey: Map<string, { id: string; key: string }>
): Promise<EnsuredViewResult> {
  const viewName = `All ${objectSpec.pluralName}`;

  let createdView = false;
  let view = await tx.view.findFirst({
    where: {
      orgId,
      objectId,
      name: viewName,
    },
  });

  if (!view) {
    view = await tx.view.create({
      data: {
        orgId,
        objectId,
        name: viewName,
        type: ViewType.TABLE,
        isDefault: true,
        // M24-1: системный «All <Object>» виден всему workspace (с READ к объекту), а не приватен.
        scope: ViewScope.SHARED,
        order: 0,
      },
    });
    createdView = true;
  } else {
    view = await tx.view.update({
      where: { id: view.id },
      data: {
        type: ViewType.TABLE,
        isDefault: true,
        scope: ViewScope.SHARED,
        archivedAt: null,
      },
    });
  }

  for (let index = 0; index < objectSpec.defaultViewAttributeKeys.length; index += 1) {
    const attributeKey = objectSpec.defaultViewAttributeKeys[index];
    const attribute = attributesByKey.get(attributeMapKey(objectSpec.key, attributeKey));

    if (!attribute) {
      continue;
    }

    const existingColumn = await tx.viewColumn.findUnique({
      where: {
        viewId_attributeId: {
          viewId: view.id,
          attributeId: attribute.id,
        },
      },
    });

    if (existingColumn) {
      await tx.viewColumn.update({
        where: { id: existingColumn.id },
        data: {
          order: index,
          isVisible: true,
          width: index === 0 ? 240 : 180,
        },
      });
      continue;
    }

    await tx.viewColumn.create({
      data: {
        orgId,
        viewId: view.id,
        attributeId: attribute.id,
        order: index,
        width: index === 0 ? 240 : 180,
        isVisible: true,
      },
    });
  }

  return {
    id: view.id,
    name: view.name,
    created: createdView,
  };
}

export async function ensureCrmForOrg(orgId: string): Promise<CrmBootstrapResult> {
  const result = await prisma.$transaction(async (tx) => {
    let createdAnything = false;
    const objectsByKey = new Map<string, { id: string; key: string }>();
    const attributesByKey = new Map<string, { id: string; key: string }>();
    const resultByObjectKey = new Map<string, EnsuredObjectResult>();
    const objectsResult: EnsuredObjectResult[] = [];

    for (const objectSpec of STANDARD_OBJECT_SPECS) {
      let objectCreated = false;
      let crmObject = await tx.object.findUnique({
        where: {
          orgId_key: {
            orgId,
            key: objectSpec.key,
          },
        },
      });

      if (!crmObject) {
        crmObject = await tx.object.create({
          data: {
            orgId,
            key: objectSpec.key,
            singularName: objectSpec.singularName,
            pluralName: objectSpec.pluralName,
            description: objectSpec.description ?? null,
            icon: objectSpec.icon ?? null,
            color: objectSpec.color ?? null,
            isSystem: true,
            isHidden: false,
          },
        });
        objectCreated = true;
        createdAnything = true;
      } else {
        crmObject = await tx.object.update({
          where: { id: crmObject.id },
          data: {
            singularName: objectSpec.singularName,
            pluralName: objectSpec.pluralName,
            description: objectSpec.description ?? null,
            icon: objectSpec.icon ?? null,
            color: objectSpec.color ?? null,
            isSystem: true,
            isHidden: false,
            archivedAt: null,
          },
        });
      }

      const objectResult: EnsuredObjectResult = {
        key: crmObject.key,
        id: crmObject.id,
        created: objectCreated,
        attributes: [],
        view: null,
      };

      objectsByKey.set(objectSpec.key, { id: crmObject.id, key: crmObject.key });
      resultByObjectKey.set(objectSpec.key, objectResult);
      objectsResult.push(objectResult);
    }

    for (const objectSpec of STANDARD_OBJECT_SPECS) {
      const crmObject = objectsByKey.get(objectSpec.key);
      const objectResult = resultByObjectKey.get(objectSpec.key);

      if (!crmObject || !objectResult) {
        continue;
      }

      for (const attributeSpec of objectSpec.attributes) {
        let attributeCreated = false;
        let attribute = await tx.attribute.findUnique({
          where: {
            objectId_key: {
              objectId: crmObject.id,
              key: attributeSpec.key,
            },
          },
        });

        if (!attribute) {
          const createData: Prisma.AttributeUncheckedCreateInput = {
            orgId,
            objectId: crmObject.id,
            key: attributeSpec.key,
            name: attributeSpec.name,
            description: attributeSpec.description ?? null,
            type: attributeSpec.type,
            isSystem: true,
            isRequired: attributeSpec.isRequired ?? false,
            isUnique: attributeSpec.isUnique ?? false,
            isPrimary: attributeSpec.isPrimary ?? false,
            order: attributeSpec.order,
          };

          if (attributeSpec.config !== undefined) {
            createData.config = attributeSpec.config;
          }

          attribute = await tx.attribute.create({
            data: createData,
          });
          attributeCreated = true;
          createdAnything = true;
        } else {
          const updateData: Prisma.AttributeUpdateInput = {
            name: attributeSpec.name,
            description: attributeSpec.description ?? null,
            type: attributeSpec.type,
            isSystem: true,
            isRequired: attributeSpec.isRequired ?? false,
            isUnique: attributeSpec.isUnique ?? false,
            isPrimary: attributeSpec.isPrimary ?? false,
            isArchived: false,
            archivedAt: null,
            order: attributeSpec.order,
          };

          if (attributeSpec.config !== undefined) {
            updateData.config = attributeSpec.config;
          }

          attribute = await tx.attribute.update({
            where: { id: attribute.id },
            data: updateData,
          });
        }

        if (attributeSpec.isPrimary) {
          await tx.attribute.updateMany({
            where: {
              objectId: crmObject.id,
              id: { not: attribute.id },
              isPrimary: true,
            },
            data: { isPrimary: false },
          });

          await tx.object.update({
            where: { id: crmObject.id },
            data: {
              primaryAttributeId: attribute.id,
            },
          });
        }

        const ensuredOptions = await ensureAttributeOptions(
          tx,
          orgId,
          attribute.id,
          attributeSpec.options
        );

        if (ensuredOptions.some((option) => option.created)) {
          createdAnything = true;
        }

        let relationshipDefinitionId: string | null = null;

        if (attributeSpec.relationship) {
          const targetObject = objectsByKey.get(attributeSpec.relationship.targetObjectKey);

          if (!targetObject) {
            throw new Error(
              `Target CRM object "${attributeSpec.relationship.targetObjectKey}" is not available`
            );
          }

          const relationshipResult = await ensureRelationshipDefinition(
            tx,
            orgId,
            crmObject.id,
            attribute.id,
            targetObject.id,
            attributeSpec.relationship
          );

          relationshipDefinitionId = relationshipResult.id;

          if (relationshipResult.created) {
            createdAnything = true;
          }
        }

        attributesByKey.set(attributeMapKey(objectSpec.key, attributeSpec.key), {
          id: attribute.id,
          key: attribute.key,
        });

        objectResult.attributes.push({
          key: attribute.key,
          id: attribute.id,
          created: attributeCreated,
          options: ensuredOptions,
          relationshipDefinitionId,
        });
      }
    }

    for (const objectSpec of STANDARD_OBJECT_SPECS) {
      const crmObject = objectsByKey.get(objectSpec.key);
      const objectResult = resultByObjectKey.get(objectSpec.key);

      if (!crmObject || !objectResult) {
        continue;
      }

      const viewResult = await ensureDefaultView(tx, orgId, crmObject.id, objectSpec, attributesByKey);
      objectResult.view = viewResult;

      if (viewResult.created) {
        createdAnything = true;
      }
    }

    return {
      orgId,
      created: createdAnything,
      objects: objectsResult,
    };
  });

  // REL-1: reverse-атрибуты обеспечиваем ПОСЛЕ коммита bootstrap (отдельные tx) — чтобы возможный P2002
  // на гонке не отравил единую большую транзакцию ensureCrmForOrg (адверс-ревью MEDIUM-2).
  await backfillReverseAttributes(orgId).catch(() => { /* maintenance-шаг, не валим bootstrap */ });
  return result;
}