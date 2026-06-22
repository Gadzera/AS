/**
 * Onboarding + demo-mode (M22-2, S400/S401/S403). /api/onboarding.
 *  GET  /status   — bootstrapped? + onboardingCompletedAt + honest capability-флаги (email/ai/billing).
 *  POST /complete — ИДЕМПОТЕНТНО (правка GPT): ensureCrmForOrg + ensurePermissionDefaults + флаг (без дублей org/grants).
 * Demo-режим: всё работает без внешних ключей; capabilities честно показывают, что не настроено.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireOrg } from '../middleware/auth';
import { ensureCrmForOrg } from '../services/crm/bootstrap';
import { ensurePermissionDefaults } from '../services/permissions';
import { isSmtpConfigured } from '../services/email';
import { llmAvailable } from '../services/llm';
import { config } from '../config';

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate, requireOrg);

// honest capability-флаги (demo-режим = чего нет)
function capabilities() {
  return {
    email: isSmtpConfigured(), // SMTP для реальной отправки/дайджеста
    ai: llmAvailable(), // LLM-провайдер (DeepSeek)
    billing: config.stripe.secretKey.trim().length > 0, // Stripe
  };
}

router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const [objectCount, recordCount, org] = await Promise.all([
      prisma.object.count({ where: { orgId, archivedAt: null } }),
      prisma.record.count({ where: { orgId, archivedAt: null } }),
      prisma.organization.findUnique({ where: { id: orgId }, select: { onboardingCompletedAt: true, name: true } }),
    ]);
    res.json({
      bootstrapped: objectCount > 0,
      completed: !!org?.onboardingCompletedAt,
      onboardingCompletedAt: org?.onboardingCompletedAt ?? null,
      workspaceName: org?.name ?? null,
      objectCount, recordCount,
      capabilities: capabilities(),
    });
  } catch (err) { next(err); }
});

// POST /complete — идемпотентный bootstrap + grants + флаг. Повторный заход НЕ плодит дубли.
router.post('/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const before = await prisma.organization.findUnique({ where: { id: orgId }, select: { onboardingCompletedAt: true } });
    await ensureCrmForOrg(orgId); // upsert объектов/атрибутов — идемпотентно
    await ensurePermissionDefaults(orgId); // seed-гранты — createMany skipDuplicates, идемпотентно
    // флаг ставим только если не стоял (без перезаписи времени) — никаких дублей
    if (!before?.onboardingCompletedAt) {
      await prisma.organization.updateMany({ where: { id: orgId, onboardingCompletedAt: null }, data: { onboardingCompletedAt: new Date() } });
    }
    const objectCount = await prisma.object.count({ where: { orgId, archivedAt: null } });
    res.json({ ok: true, alreadyCompleted: !!before?.onboardingCompletedAt, objectCount });
  } catch (err) { next(err); }
});

export default router;
