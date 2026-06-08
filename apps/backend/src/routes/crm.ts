import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

import { authenticate, requireOrg } from '../middleware/auth';
import { ensureCrmForOrg } from '../services/crm/bootstrap';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate, requireOrg);

const STANDARD_OBJECT_KEYS = ['companies', 'people', 'deals'] as const;

// POST /api/crm/bootstrap
router.post('/bootstrap', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const result = await ensureCrmForOrg(orgId);

    res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/crm/status
router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;

    const [totalObjects, standardObjects] = await Promise.all([
      prisma.object.count({
        where: {
          orgId,
          archivedAt: null,
        },
      }),
      prisma.object.findMany({
        where: {
          orgId,
          key: { in: [...STANDARD_OBJECT_KEYS] },
          archivedAt: null,
        },
        select: {
          id: true,
          key: true,
          pluralName: true,
        },
      }),
    ]);

    const objectByKey = new Map(standardObjects.map((object) => [object.key, object]));

    const [companiesCount, peopleCount, dealsCount] = await Promise.all([
      objectByKey.get('companies')
        ? prisma.record.count({
            where: {
              orgId,
              objectId: objectByKey.get('companies')!.id,
              archivedAt: null,
            },
          })
        : Promise.resolve(0),
      objectByKey.get('people')
        ? prisma.record.count({
            where: {
              orgId,
              objectId: objectByKey.get('people')!.id,
              archivedAt: null,
            },
          })
        : Promise.resolve(0),
      objectByKey.get('deals')
        ? prisma.record.count({
            where: {
              orgId,
              objectId: objectByKey.get('deals')!.id,
              archivedAt: null,
            },
          })
        : Promise.resolve(0),
    ]);

    res.json({
      hasObjects: totalObjects > 0,
      totalObjects,
      standardObjects: {
        companies: Boolean(objectByKey.get('companies')),
        people: Boolean(objectByKey.get('people')),
        deals: Boolean(objectByKey.get('deals')),
      },
      counts: {
        companies: companiesCount,
        people: peopleCount,
        deals: dealsCount,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;