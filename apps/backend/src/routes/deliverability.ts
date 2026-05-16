import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireOrg } from '../middleware/auth';
import { checkDeliverability } from '../utils/deliverability';
import { validateEmail } from '../utils/emailValidation';

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate, requireOrg);

// GET /api/deliverability/check?domain=acme.com
router.get('/check', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const domain = req.query.domain as string;
    if (!domain) { res.status(400).json({ error: 'domain query param required' }); return; }
    const result = await checkDeliverability(domain.toLowerCase().trim());
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

// POST /api/deliverability/validate — validate single or batch emails
router.post('/validate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, emails } = req.body as { email?: string; emails?: string[] };

    if (email) {
      const result = await validateEmail(email);
      res.json(result);
      return;
    }

    if (emails?.length) {
      const results: Record<string, { valid: boolean; reason?: string }> = {};
      await Promise.all(emails.slice(0, 100).map(async e => {
        results[e] = await validateEmail(e);
      }));
      res.json(results);
      return;
    }

    res.status(400).json({ error: 'Provide email or emails[]' });
  } catch (err) { next(err); }
});

export default router;
