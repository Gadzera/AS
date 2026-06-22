import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireOrg } from '../middleware/auth';
import { generateInsights, setInsightAck } from '../services/insights';

const router = Router();
router.use(authenticate, requireOrg);

// GET /api/insights — Learning-инсайты из реальных агрегатов (LLM-narrated / grounded demo)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const result = await generateInsights(orgId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/insights/ack — отметить/снять «просмотрено» по стабильному ключу инсайта.
// Body: { key: string, acknowledged: boolean }. Переживает перезагрузку (insight_acks).
router.post('/ack', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const key = typeof req.body?.key === 'string' ? req.body.key.trim() : '';
    const acknowledged = Boolean(req.body?.acknowledged);
    if (!key) return res.status(400).json({ error: 'key is required' });
    const value = await setInsightAck(orgId, key, acknowledged);
    res.json({ key, acknowledged: value });
  } catch (err) {
    next(err);
  }
});

export default router;
