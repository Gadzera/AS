/**
 * Команда организации (M11/RBAC).
 *  - GET    /api/team/members        — список участников org.
 *  - POST   /api/team/invite         — пригласить участника (OWNER/ADMIN). Создаёт реального
 *                                      пользователя в org. Письмо-приглашение — внешний сервис
 *                                      (подключим позже); в демо-режиме временный пароль
 *                                      возвращается в ответе (tempPassword), чтобы flow проходил.
 *  - PATCH  /api/team/members/:id     — сменить роль (только OWNER; OWNER неизменяем).
 *  - DELETE /api/team/members/:id     — удалить участника из org (OWNER/ADMIN; нельзя себя/последнего OWNER).
 */

import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireOrg } from '../middleware/auth';
import { audit } from '../services/audit';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate, requireOrg);

function canManage(role: string): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

router.get('/members', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const members = await prisma.user.findMany({
      where: { orgId },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });
    res.json({ members, total: members.length, canManage: canManage(req.user!.role), isOwner: req.user!.role === 'OWNER' });
  } catch (err) {
    next(err);
  }
});

// GET /api/team/audit — последние access-sensitive события (наблюдаемость прод-готовности).
router.get('/audit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!canManage(req.user!.role)) { res.status(403).json({ error: 'Only the owner or an admin can view the audit log' }); return; }
    const orgId = req.user!.orgId!;
    const entries = await prisma.auditLog.findMany({ where: { orgId }, orderBy: { createdAt: 'desc' }, take: 30 });
    res.json({ entries });
  } catch (err) {
    next(err);
  }
});

const inviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  role: z.enum(['ADMIN', 'MEMBER']).optional(),
});

function genTempPassword(): string {
  // Временный пароль из стабильного алфавита (без Math.random в путях, которые должны быть
  // воспроизводимы — здесь рантайм, поэтому используем crypto).
  const bytes = require('crypto').randomBytes(9) as Buffer;
  return bytes.toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) + 'A1';
}

router.post('/invite', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!canManage(req.user!.role)) {
      res.status(403).json({ error: 'Only the owner or an admin can invite members' });
      return;
    }
    const orgId = req.user!.orgId!;
    const data = inviteSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      res.status(409).json({ error: 'A user with this email already exists' });
      return;
    }

    const tempPassword = genTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    const member = await prisma.user.create({
      data: { email: data.email, name: data.name, role: data.role ?? 'MEMBER', orgId, passwordHash },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    await audit({ orgId, actorId: req.user!.userId, actorName: req.user!.email, action: 'MEMBER_INVITED', targetType: 'user', targetId: member.id, summary: `Invited ${member.email} as ${member.role}` });

    // TODO: отправка письма-приглашения — внешний email-сервис (подключим позже).
    res.status(201).json({
      member,
      demo: true, // реальная почта не подключена → выдаём временный пароль владельцу
      tempPassword,
      message: 'Member created. Email delivery is in demo mode — share the temporary password securely.',
    });
  } catch (err) {
    next(err);
  }
});

const roleSchema = z.object({ role: z.enum(['ADMIN', 'MEMBER']) });

router.patch('/members/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'OWNER') {
      res.status(403).json({ error: 'Only the owner can change roles' });
      return;
    }
    const orgId = req.user!.orgId!;
    const { role } = roleSchema.parse(req.body);
    const target = await prisma.user.findFirst({ where: { id: req.params.id, orgId } });
    if (!target) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }
    if (target.role === 'OWNER') {
      res.status(400).json({ error: 'The owner role cannot be changed' });
      return;
    }
    // Смена роли инвалидирует старый токен участника (bump tokenVersion) → он перелогинится с новой ролью.
    const member = await prisma.user.update({
      where: { id: target.id },
      data: { role, tokenVersion: { increment: 1 } },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    await audit({ orgId, actorId: req.user!.userId, actorName: req.user!.email, action: 'ROLE_CHANGED', targetType: 'user', targetId: target.id, summary: `${member.email}: ${target.role} → ${role} (session revoked)` });
    res.json({ member });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/team/members/:id/active — деактивация/реактивация участника (OWNER/ADMIN).
router.patch('/members/:id/active', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!canManage(req.user!.role)) { res.status(403).json({ error: 'Only the owner or an admin can deactivate members' }); return; }
    const orgId = req.user!.orgId!;
    const isActive = z.object({ isActive: z.boolean() }).parse(req.body).isActive;
    if (req.params.id === req.user!.userId) { res.status(400).json({ error: 'You cannot deactivate yourself' }); return; }
    const target = await prisma.user.findFirst({ where: { id: req.params.id, orgId } });
    if (!target) { res.status(404).json({ error: 'Member not found' }); return; }
    if (target.role === 'OWNER') { res.status(400).json({ error: 'The owner cannot be deactivated' }); return; }
    // Деактивация инвалидирует токен (bump) и блокирует вход.
    const member = await prisma.user.update({
      where: { id: target.id },
      data: { isActive, tokenVersion: { increment: 1 } },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });
    await audit({ orgId, actorId: req.user!.userId, actorName: req.user!.email, action: isActive ? 'MEMBER_REACTIVATED' : 'MEMBER_DEACTIVATED', targetType: 'user', targetId: target.id, summary: `${member.email} ${isActive ? 'reactivated' : 'deactivated (session revoked)'}` });
    res.json({ member });
  } catch (err) {
    next(err);
  }
});

router.delete('/members/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!canManage(req.user!.role)) {
      res.status(403).json({ error: 'Only the owner or an admin can remove members' });
      return;
    }
    const orgId = req.user!.orgId!;
    if (req.params.id === req.user!.userId) {
      res.status(400).json({ error: 'You cannot remove yourself' });
      return;
    }
    const target = await prisma.user.findFirst({ where: { id: req.params.id, orgId } });
    if (!target) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }
    if (target.role === 'OWNER') {
      res.status(400).json({ error: 'The owner cannot be removed' });
      return;
    }
    // Полное удаление участника опасно из-за связей (кампании/записи) — переносим в «без org».
    // Bump tokenVersion → старый токен немедленно недействителен (доступ к org потерян сразу).
    await prisma.user.update({ where: { id: target.id }, data: { orgId: null, tokenVersion: { increment: 1 } } });
    await audit({ orgId, actorId: req.user!.userId, actorName: req.user!.email, action: 'MEMBER_REMOVED', targetType: 'user', targetId: target.id, summary: `Removed ${target.email} from workspace (session revoked)` });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
