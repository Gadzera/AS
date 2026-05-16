import { prisma } from '../lib/prisma';
import { Router, Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';
import { z } from 'zod';

import { authenticate, requireOrg } from '../middleware/auth';
import { createNotification } from '../services/onboarding';

const router = Router();


function genCode(): string {
  // 12 random bytes = 96 bits of entropy = 2^96 combinations (brute-force infeasible)
  return randomBytes(12).toString('hex').toUpperCase();
}

// GET /api/referral/code — get or create referral code for org
router.get('/code', authenticate, requireOrg, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    let org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) { res.status(404).json({ error: 'Org not found' }); return; }

    if (!org.referralCode) {
      org = await prisma.organization.update({
        where: { id: orgId },
        data: { referralCode: genCode() },
      });
    }

    const referrals = await prisma.organization.count({ where: { referredByOrgId: orgId } });
    const bonusLeads = referrals * 500;

    res.json({
      code: org.referralCode,
      referrals,
      bonusLeads,
      shareUrl: `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/register?ref=${org.referralCode}`,
    });
  } catch (err) { next(err); }
});

const applySchema = z.object({ code: z.string().min(1).max(50).trim() });

// POST /api/referral/apply — authenticated: apply a referral code to the caller's own org
router.post('/apply', authenticate, requireOrg, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = applySchema.parse(req.body);

    const orgId = req.user!.orgId!;

    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { referredByOrgId: true } });
    if (org?.referredByOrgId) { res.status(409).json({ error: 'Referral code already applied' }); return; }

    const referrer = await prisma.organization.findUnique({ where: { referralCode: code } });
    if (!referrer) { res.status(404).json({ error: 'Invalid referral code' }); return; }
    if (referrer.id === orgId) { res.status(400).json({ error: 'Cannot apply your own referral code' }); return; }

    await prisma.organization.update({
      where: { id: orgId },
      data: { referredByOrgId: referrer.id, bonusLeads: { increment: 200 } },
    });
    await prisma.organization.update({
      where: { id: referrer.id },
      data: { bonusLeads: { increment: 500 } },
    });

    await createNotification(referrer.id, {
      type: 'REFERRAL_JOINED',
      title: 'По вашей реферальной ссылке зарегистрировался новый пользователь',
      body: '+500 лидов добавлено к вашему балансу.',
      link: '/settings',
    });

    res.json({ ok: true, bonusLeads: 200 });
  } catch (err) { next(err); }
});

export default router;
