import { prisma } from '../lib/prisma';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';

import { authenticate, requireOrg } from '../middleware/auth';
import { checkDeliverability } from '../utils/deliverability';
import { validateEmail } from '../utils/emailValidation';

const router = Router();

router.use(authenticate, requireOrg);

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,}$/i;

// GET /api/deliverability/check?domain=acme.com
router.get('/check', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const domain = (req.query.domain as string | undefined)?.trim();
    if (!domain || !DOMAIN_RE.test(domain)) {
      res.status(400).json({ error: 'Invalid domain format' });
      return;
    }
    const result = await checkDeliverability(domain.toLowerCase());
    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/deliverability/stats — bounce rate, open rate, invalid emails for org
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;

    const [totalSent, totalOpened, totalBounced, totalReplied, invalidLeads] = await Promise.all([
      prisma.message.count({ where: { direction: 'OUTBOUND', sentAt: { not: null }, lead: { orgId } } }),
      prisma.message.count({ where: { direction: 'OUTBOUND', openedAt: { not: null }, lead: { orgId } } }),
      prisma.message.count({ where: { direction: 'OUTBOUND', bounced: true, lead: { orgId } } }),
      prisma.message.count({ where: { direction: 'INBOUND', lead: { orgId } } }),
      prisma.lead.count({ where: { orgId, emailValid: { in: ['INVALID', 'NO_MX', 'DISPOSABLE'] } } }),
    ]);

    const openRate   = totalSent > 0 ? Math.round((totalOpened / totalSent)  * 100) : 0;
    const bounceRate = totalSent > 0 ? Math.round((totalBounced / totalSent) * 100) : 0;
    const replyRate  = totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0;

    // Score based on bounce rate
    const deliverabilityScore =
      bounceRate === 0 ? 98 :
      bounceRate < 2   ? 85 :
      bounceRate < 5   ? 65 :
      bounceRate < 10  ? 40 : 15;

    res.json({
      totalSent, totalOpened, totalBounced, totalReplied,
      openRate, bounceRate, replyRate,
      invalidLeads, deliverabilityScore,
    });
  } catch (err) { next(err); }
});

const validateSchema = z.union([
  z.object({ email: z.string().email(), emails: z.undefined() }),
  z.object({ emails: z.array(z.string().email()).min(1).max(100), email: z.undefined() }),
]);

// POST /api/deliverability/validate — validate single or batch emails
router.post('/validate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = validateSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Provide email (string) or emails (array, max 100)' }); return; }
    const data = parsed.data;

    if (data.email) {
      res.json(await validateEmail(data.email));
      return;
    }

    const results: Record<string, { valid: boolean; reason?: string }> = {};
    await Promise.all(data.emails!.map(async e => { results[e] = await validateEmail(e); }));
    res.json(results);
  } catch (err) { next(err); }
});

export default router;
