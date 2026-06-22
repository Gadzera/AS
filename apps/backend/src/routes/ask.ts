/**
 * Ask AISDR (модуль 10, M26-1) — роуты ассистента: треды per-user, grounded-ответ под
 * RBAC, сохранённые pending-действия, homepage-данные (S190). Rate-limit per-user.
 * Действия только ПРЕДЛАГАЮТСЯ и сохраняются (PENDING) — apply-эндпоинт в M26-2.
 */

import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { PrismaClient, Prisma } from '@prisma/client';
import { z } from 'zod';
import { authenticate, requireOrg } from '../middleware/auth';
import { answerQuestion, starterSuggestions, homeData, type AskAction } from '../services/ask';
import { applyAskAction, AskApplyError } from '../services/askApply';
import { CrmValueValidationError } from '../services/crm/values';
import { audit } from '../services/audit';

const prisma = new PrismaClient();
const router = Router();
router.use(authenticate, requireOrg);

// менеджер org (OWNER/ADMIN) — может управлять WORKSPACE-промптами
function isManager(role: string | null | undefined): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

// Per-user rate-limit на запросы к ассистенту (обяз. правка GPT: обычный Ask не должен стать LLM-loop).
const askLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  keyGenerator: (req: Request) => req.user?.userId ?? req.ip ?? 'anon',
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many questions — give the assistant a moment.' },
});
// адверс MEDIUM: read-эндпоинты (/starters,/home) тоже зовут gatherContext → отдельный, более щедрый лимит per-user.
const askReadLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  keyGenerator: (req: Request) => req.user?.userId ?? req.ip ?? 'anon',
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — slow down a moment.' },
});
// M26-2 (обяз. правка GPT): per-user лимит на apply действий — чтобы confirm-кнопка не стала циклом мутаций.
const askActionLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  keyGenerator: (req: Request) => req.user?.userId ?? req.ip ?? 'anon',
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many actions — give it a moment.' },
});

// GET /api/ask/starters — стартовые подсказки + видимый агенту контекст (per-user).
router.get('/starters', askReadLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await starterSuggestions(req.user!.orgId!, req.user!.userId, req.user!.role));
  } catch (err) {
    next(err);
  }
});

// GET /api/ask/home — homepage S190: greeting + recent chats + upcoming meetings + open tasks (всё реальное).
router.get('/home', askReadLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await homeData(req.user!.orgId!, req.user!.userId, req.user!.role));
  } catch (err) {
    next(err);
  }
});

// GET /api/ask/chats — список чатов ТЕКУЩЕГО пользователя (для sidebar/homepage recent).
router.get('/chats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId;
    const chats = await prisma.assistantChat.findMany({
      where: { orgId, userId, archivedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: 30,
      select: { id: true, title: true, updatedAt: true, messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { content: true, role: true } } },
    });
    res.json({ chats: chats.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt.toISOString(), preview: (c.messages[0]?.content ?? '').slice(0, 90) })) });
  } catch (err) {
    next(err);
  }
});

// GET /api/ask/chats/:chatId — тред (только владельца, иначе 404 — скрытие).
router.get('/chats/:chatId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId;
    const chat = await prisma.assistantChat.findFirst({
      where: { id: req.params.chatId, orgId, userId, archivedAt: null },
      select: {
        id: true, title: true, createdAt: true,
        messages: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, role: true, content: true, citations: true, generatedBy: true, createdAt: true, actions: { select: { id: true, kind: true, payload: true, status: true } } },
        },
      },
    });
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    res.json({
      id: chat.id,
      title: chat.title,
      messages: chat.messages.map((m) => ({
        id: m.id, role: m.role, content: m.content, citations: m.citations ?? [], generatedBy: m.generatedBy, createdAt: m.createdAt.toISOString(),
        action: m.actions[0] ? { id: m.actions[0].id, kind: m.actions[0].kind, status: m.actions[0].status, ...(m.actions[0].payload as object) } : null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/ask/chats/:chatId — архивировать чат (только владельца).
router.delete('/chats/:chatId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId;
    const r = await prisma.assistantChat.updateMany({ where: { id: req.params.chatId, orgId, userId, archivedAt: null }, data: { archivedAt: new Date() } });
    if (r.count === 0) return res.status(404).json({ error: 'Chat not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/ask — задать вопрос. Body: { question, chatId? }. Заземление под RBAC; сохраняем тред + pending-действие.
router.post('/', askLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId;
    const role = req.user!.role;
    const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
    const chatIdIn = typeof req.body?.chatId === 'string' ? req.body.chatId : null;
    if (!question) return res.status(400).json({ error: 'question is required' });
    if (question.length > 600) return res.status(400).json({ error: 'question too long' });

    // чат: либо существующий владельца, либо новый
    let chatId: string;
    let isNew = false;
    if (chatIdIn) {
      const existing = await prisma.assistantChat.findFirst({ where: { id: chatIdIn, orgId, userId, archivedAt: null }, select: { id: true } });
      if (!existing) return res.status(404).json({ error: 'Chat not found' });
      chatId = existing.id;
    } else {
      const created = await prisma.assistantChat.create({ data: { orgId, userId, title: question.slice(0, 60) || 'New chat' } });
      chatId = created.id;
      isNew = true;
      void audit({ orgId, actorId: userId, action: 'ASK_CHAT_CREATED', targetType: 'AssistantChat', targetId: chatId, summary: 'Ask AISDR chat created' });
    }

    // user-сообщение
    await prisma.assistantMessage.create({ data: { orgId, chatId, role: 'USER', content: question } });

    // ответ под RBAC
    const result = await answerQuestion(orgId, userId, role, question);

    // assistant-сообщение
    const asstMsg = await prisma.assistantMessage.create({
      data: { orgId, chatId, role: 'ASSISTANT', content: result.answer, citations: result.citations as unknown as Prisma.InputJsonValue, generatedBy: result.generatedBy },
    });

    // сохранённое pending-действие (канонический JSON; apply — M26-2)
    let actionOut: (AskAction & { id: string; status: string }) | null = null;
    if (result.action) {
      const act = await prisma.askAction.create({
        data: { orgId, chatId, messageId: asstMsg.id, userId, kind: result.action.kind, payload: result.action as unknown as Prisma.InputJsonValue, status: 'PENDING' },
      });
      actionOut = { ...result.action, id: act.id, status: 'PENDING' };
      void audit({ orgId, actorId: userId, action: 'ASK_ACTION_PROPOSED', targetType: 'AskAction', targetId: act.id, summary: `Proposed ${result.action.kind}` });
    }

    // бамп updatedAt чата (для recent-сортировки) — адверс LOW: всегда трогаем updatedAt, иначе continued-чат не всплывает
    await prisma.assistantChat.update({ where: { id: chatId }, data: { updatedAt: new Date(), ...(isNew ? { title: question.slice(0, 60) || 'New chat' } : {}) } });

    res.json({
      chatId,
      messageId: asstMsg.id,
      answer: result.answer,
      citations: result.citations,
      action: actionOut,
      suggestions: result.suggestions,
      generatedBy: result.generatedBy,
      context: result.context,
      webResearch: result.webResearch,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/ask/actions/:id/apply — РЕАЛЬНО применить сохранённое действие (M26-2).
// Body: { clientRequestId? } для идемпотентности двойного клика. Читает canonical payload, НЕ зовёт LLM.
router.post('/actions/:id/apply', askActionLimiter, async (req: Request, res: Response) => {
  try {
    const clientRequestId = typeof req.body?.clientRequestId === 'string' ? req.body.clientRequestId.slice(0, 80) : undefined;
    const outcome = await applyAskAction({ orgId: req.user!.orgId!, userId: req.user!.userId, role: req.user!.role }, req.params.id, clientRequestId);
    res.json(outcome);
  } catch (err) {
    if (err instanceof AskApplyError) return res.status(err.status).json({ error: err.message, code: err.code });
    if (err instanceof CrmValueValidationError) return res.status(422).json({ error: err.message, code: 'INVALID_VALUE' });
    res.status(500).json({ error: 'Could not apply the action' });
  }
});

// ─── Prompt Library (M26-2, S187/S188) ───────────────────────────────────────
// PERSONAL — личные промпты пользователя; WORKSPACE — общие (CRUD только OWNER/ADMIN, reuse — всем в org).

const savedPromptSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(4000),
  scope: z.enum(['PERSONAL', 'WORKSPACE']).default('PERSONAL'),
});

// GET /api/ask/prompts — личные пользователя + все workspace org. canEdit отражает RBAC.
router.get('/prompts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId;
    const manager = isManager(req.user!.role);
    const prompts = await prisma.savedPrompt.findMany({
      where: { orgId, archivedAt: null, OR: [{ scope: 'WORKSPACE' }, { scope: 'PERSONAL', userId }] },
      orderBy: [{ scope: 'asc' }, { updatedAt: 'desc' }],
      take: 100,
      select: { id: true, title: true, body: true, scope: true, userId: true, updatedAt: true },
    });
    res.json({
      prompts: prompts.map((p) => ({
        id: p.id,
        title: p.title,
        body: p.body,
        scope: p.scope,
        updatedAt: p.updatedAt.toISOString(),
        canEdit: p.scope === 'WORKSPACE' ? manager : p.userId === userId,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/ask/prompts — создать. WORKSPACE требует OWNER/ADMIN.
router.post('/prompts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId;
    const data = savedPromptSchema.parse(req.body);
    if (data.scope === 'WORKSPACE' && !isManager(req.user!.role)) {
      return res.status(403).json({ error: 'Only workspace admins can create workspace prompts', code: 'PERMISSION_DENIED' });
    }
    const created = await prisma.savedPrompt.create({ data: { orgId, userId, scope: data.scope, title: data.title, body: data.body }, select: { id: true } });
    void audit({ orgId, actorId: userId, action: 'SAVED_PROMPT_CREATED', targetType: 'SavedPrompt', targetId: created.id, summary: `Saved prompt created (${data.scope})` });
    res.status(201).json({ id: created.id });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid prompt', details: err.issues });
    next(err);
  }
});

// PATCH /api/ask/prompts/:id — править. PERSONAL — только свой; WORKSPACE — только OWNER/ADMIN.
router.patch('/prompts/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId;
    const data = savedPromptSchema.partial({ scope: true }).parse(req.body);
    const existing = await prisma.savedPrompt.findFirst({ where: { id: req.params.id, orgId, archivedAt: null }, select: { id: true, scope: true, userId: true } });
    if (!existing) return res.status(404).json({ error: 'Prompt not found' });
    const canEdit = existing.scope === 'WORKSPACE' ? isManager(req.user!.role) : existing.userId === userId;
    if (!canEdit) return res.status(403).json({ error: 'You can’t edit this prompt', code: 'PERMISSION_DENIED' });
    await prisma.savedPrompt.update({ where: { id: existing.id }, data: { ...(data.title ? { title: data.title } : {}), ...(data.body ? { body: data.body } : {}) } });
    void audit({ orgId, actorId: userId, action: 'SAVED_PROMPT_UPDATED', targetType: 'SavedPrompt', targetId: existing.id, summary: 'Saved prompt updated' });
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid prompt', details: err.issues });
    next(err);
  }
});

// DELETE /api/ask/prompts/:id — мягко архивировать. Те же RBAC-правила.
router.delete('/prompts/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId;
    const existing = await prisma.savedPrompt.findFirst({ where: { id: req.params.id, orgId, archivedAt: null }, select: { id: true, scope: true, userId: true } });
    if (!existing) return res.status(404).json({ error: 'Prompt not found' });
    const canEdit = existing.scope === 'WORKSPACE' ? isManager(req.user!.role) : existing.userId === userId;
    if (!canEdit) return res.status(403).json({ error: 'You can’t delete this prompt', code: 'PERMISSION_DENIED' });
    await prisma.savedPrompt.update({ where: { id: existing.id }, data: { archivedAt: new Date() } });
    void audit({ orgId, actorId: userId, action: 'SAVED_PROMPT_DELETED', targetType: 'SavedPrompt', targetId: existing.id, summary: 'Saved prompt deleted' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
