import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireOrg } from '../middleware/auth';
import { createNotification } from '../services/onboarding';

const router = Router();
const prisma = new PrismaClient();

function genCode(orgId: string): string {
  return orgId.slice(-6).toUpperCase() + Math.random().toString(36).slice(-3).toUpperCase();
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
        data: { referralCode: genCode(orgId) },
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

// POST /api/referral/apply — apply referral code on register (called internally)
router.post('/apply', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, newOrgId } = req.body as { code: string; newOrgId: string };
    const referrer = await prisma.organization.findUnique({ where: { referralCode: code } });
    if (!referrer) { res.status(404).json({ error: 'Invalid code' }); return; }

    await prisma.organization.update({
      where: { id: newOrgId },
      data: { referredByOrgId: referrer.id, bonusLeads: 200 },
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
