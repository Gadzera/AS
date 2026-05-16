import { prisma } from '../lib/prisma';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';

import { authenticate, requireOrg } from '../middleware/auth';
import { verifySmtpAccount } from '../services/smtpRotation';
import { encrypt } from '../utils/encryption';
import { updateOnboardingStep } from '../services/onboarding';

const router = Router();

router.use(authenticate, requireOrg);

const accountSchema = z.object({
  name:        z.string().min(1),
  host:        z.string().min(1),
  port:        z.number().int().default(587),
  user:        z.string().min(1),
  pass:        z.string().min(1),
  fromName:    z.string().optional(),
  fromEmail:   z.string().email(),
  imapHost:    z.string().optional().nullable(),
  imapPort:    z.number().int().optional().nullable(),
  imapUser:    z.string().optional().nullable(),
  imapPass:    z.string().optional().nullable(),
  imapEnabled: z.boolean().optional().default(false),
});

// GET /api/smtp — list accounts
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accounts = await prisma.smtpAccount.findMany({
      where: { orgId: req.user!.orgId! },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, host: true, port: true, fromEmail: true, fromName: true, active: true, imapHost: true, imapPort: true, imapUser: true, imapEnabled: true, createdAt: true },
    });
    res.json(accounts);
  } catch (err) { next(err); }
});

// POST /api/smtp — add account
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data    = accountSchema.parse(req.body);
    const { imapPass: rawImapPass, ...rest } = data;
    const account = await prisma.smtpAccount.create({
      data: {
        ...rest,
        pass:     encrypt(data.pass),
        imapPass: rawImapPass ? encrypt(rawImapPass) : null,
        orgId:    req.user!.orgId!,
      },
    });
    // Verify immediately
    const ok = await verifySmtpAccount(account);
    if (!ok) {
      await prisma.smtpAccount.delete({ where: { id: account.id } });
      res.status(400).json({ error: 'Could not connect to SMTP server. Check credentials.' });
      return;
    }
    updateOnboardingStep(req.user!.orgId!, 'smtpAdded').catch(() => null);
    res.status(201).json({ id: account.id, name: account.name, fromEmail: account.fromEmail, active: account.active });
  } catch (err) { next(err); }
});

// PUT /api/smtp/:id — update account settings (active toggle + IMAP config)
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updateSchema = z.object({
      active:      z.boolean().optional(),
      imapHost:    z.string().optional().nullable(),
      imapPort:    z.number().int().optional().nullable(),
      imapUser:    z.string().optional().nullable(),
      imapPass:    z.string().optional().nullable(),
      imapEnabled: z.boolean().optional(),
    });
    const data = updateSchema.parse(req.body);
    const account = await prisma.smtpAccount.findFirst({
      where: { id: req.params.id, orgId: req.user!.orgId! },
    });
    if (!account) { res.status(404).json({ error: 'Not found' }); return; }

    const { imapPass: rawImapPass, ...rest } = data;
    const updated = await prisma.smtpAccount.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        ...(rawImapPass !== undefined ? { imapPass: rawImapPass ? encrypt(rawImapPass) : null } : {}),
      },
      select: { id: true, name: true, host: true, port: true, fromEmail: true, fromName: true, active: true, imapHost: true, imapPort: true, imapUser: true, imapEnabled: true },
    });
    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /api/smtp/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const account = await prisma.smtpAccount.findFirst({
      where: { id: req.params.id, orgId: req.user!.orgId! },
    });
    if (!account) { res.status(404).json({ error: 'Not found' }); return; }
    await prisma.smtpAccount.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/smtp/:id/verify
router.post('/:id/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const account = await prisma.smtpAccount.findFirst({
      where: { id: req.params.id, orgId: req.user!.orgId! },
    });
    if (!account) { res.status(404).json({ error: 'Not found' }); return; }
    const ok = await verifySmtpAccount(account);
    res.json({ ok });
  } catch (err) { next(err); }
});

export default router;
