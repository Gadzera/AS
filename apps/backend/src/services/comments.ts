/**
 * Comments + @mentions (M22-1, S396/S397). Backend = source-of-truth для @mention (правка GPT):
 * @[userId] валидируется (user в org + active + READ к объекту записи); недоступный/cross-org → skip (без notify).
 * Reply → notify автору родителя (НЕ себе). Soft-delete (deletedAt). Дубль mention в комменте → один CommentMention.
 */
import { PrismaClient } from '@prisma/client';
import { resolveAccess, meets } from './permissions';
import { notify } from './notifications';

const prisma = new PrismaClient();

export class CommentError extends Error {
  constructor(public code: string, message: string, public statusCode = 400) { super(message); }
}

// @[userId] → список уникальных userId. Кап MAX_MENTIONS (адверс-ревью #5: без капа — DoS-амплификация resolveAccess).
const MENTION_RE = /@\[([A-Za-z0-9_-]{1,40})\]/g;
const MAX_MENTIONS = 30;
export function parseMentionIds(body: string): string[] {
  const ids = new Set<string>();
  let m: RegExpExecArray | null;
  MENTION_RE.lastIndex = 0;
  while ((m = MENTION_RE.exec(body)) !== null) { ids.add(m[1]); if (ids.size >= MAX_MENTIONS) break; }
  return [...ids];
}

export type MentionSkip = { userId: string; reason: 'not-in-workspace' | 'inactive' | 'no-access' };

// Валидирует упомянутых: org + active + READ к объекту записи. cross-org/unknown → not-in-workspace.
export async function validateMentions(orgId: string, objectId: string, rawIds: string[]): Promise<{ valid: string[]; skipped: MentionSkip[] }> {
  const valid: string[] = [];
  const skipped: MentionSkip[] = [];
  if (!rawIds.length) return { valid, skipped };
  const users = await prisma.user.findMany({ where: { id: { in: rawIds } }, select: { id: true, orgId: true, isActive: true, role: true } });
  const byId = new Map(users.map((u) => [u.id, u]));
  for (const uid of rawIds) {
    const u = byId.get(uid);
    if (!u || u.orgId !== orgId) { skipped.push({ userId: uid, reason: 'not-in-workspace' }); continue; } // cross-org/unknown
    if (!u.isActive) { skipped.push({ userId: uid, reason: 'inactive' }); continue; }
    const lvl = await resolveAccess(orgId, { userId: u.id, role: u.role }, 'OBJECT', objectId);
    if (!meets(lvl, 'READ')) { skipped.push({ userId: uid, reason: 'no-access' }); continue; } // не утечь скрытую запись
    valid.push(uid);
  }
  return { valid, skipped };
}

// ещё ли пользователь имеет READ к объекту (для REPLY-уведомления автору родителя)
async function canStillRead(orgId: string, userId: string, objectId: string): Promise<boolean> {
  const u = await prisma.user.findFirst({ where: { id: userId, orgId, isActive: true }, select: { role: true } });
  if (!u) return false;
  return meets(await resolveAccess(orgId, { userId, role: u.role }, 'OBJECT', objectId), 'READ');
}

type Author = { userId: string };

export async function createComment(orgId: string, recordId: string, author: Author, body: string, parentId?: string | null) {
  const record = await prisma.record.findFirst({ where: { id: recordId, orgId, archivedAt: null }, select: { id: true, objectId: true, displayName: true } });
  if (!record) throw new CommentError('RECORD_NOT_FOUND', 'Record not found', 404);

  let parent: { id: string; authorId: string; parentId: string | null } | null = null;
  if (parentId) {
    // адверс-ревью #4: разрешаем ответ на soft-deleted корень (тред не «замораживается»); deletedAt-фильтра нет
    parent = await prisma.comment.findFirst({ where: { id: parentId, orgId, recordId }, select: { id: true, authorId: true, parentId: true } });
    if (!parent) throw new CommentError('PARENT_NOT_FOUND', 'Parent comment not found', 404);
    if (parent.parentId) throw new CommentError('NESTING_TOO_DEEP', 'Replies are one level deep only', 400); // 1-уровневые ответы
  }

  const rawIds = parseMentionIds(body);
  const { valid, skipped } = await validateMentions(orgId, record.objectId, rawIds);

  const comment = await prisma.comment.create({ data: { orgId, recordId, authorId: author.userId, body, parentId: parentId ?? null } });
  if (valid.length) await prisma.commentMention.createMany({ data: valid.map((uid) => ({ orgId, commentId: comment.id, userId: uid })), skipDuplicates: true });
  await prisma.activity.create({ data: { orgId, recordId, actorId: author.userId, type: 'COMMENT_CREATED', title: parentId ? 'Reply added' : 'Comment added', payload: { commentId: comment.id, parentId: parentId ?? null, mentions: valid.length } } });

  const recordName = record.displayName ?? 'a record';
  // MENTION → каждому валидному (НЕ себе)
  for (const uid of valid) {
    if (uid === author.userId) continue;
    await notify({ orgId, source: 'SYSTEM', type: 'MENTION', title: `You were mentioned on ${recordName}`, body: body.slice(0, 140), entityType: 'record', entityId: recordId, dedupeKey: `mention:${comment.id}:${uid}`, recipientUserIds: [uid] });
  }
  // REPLY → автору родителя (НЕ себе) ТОЛЬКО если он ещё имеет READ к объекту (адверс-ревью #2: не светить имя записи потерявшему доступ)
  if (parent && parent.authorId !== author.userId && (await canStillRead(orgId, parent.authorId, record.objectId))) {
    await notify({ orgId, source: 'SYSTEM', type: 'REPLY', title: `New reply on ${recordName}`, body: body.slice(0, 140), entityType: 'record', entityId: recordId, dedupeKey: `reply:${comment.id}`, recipientUserIds: [parent.authorId] });
  }

  return { comment, mentions: valid, mentionsSkipped: skipped };
}

export async function editComment(orgId: string, recordId: string, commentId: string, actor: { userId: string; isManager: boolean }, body: string) {
  const existing = await prisma.comment.findFirst({ where: { id: commentId, orgId, recordId, deletedAt: null }, select: { id: true, authorId: true } });
  if (!existing) throw new CommentError('COMMENT_NOT_FOUND', 'Comment not found', 404);
  if (existing.authorId !== actor.userId) throw new CommentError('NOT_AUTHOR', 'You can only edit your own comment', 403); // правка — только автор
  const record = await prisma.record.findFirst({ where: { id: recordId, orgId }, select: { objectId: true, displayName: true } });
  if (!record) throw new CommentError('RECORD_NOT_FOUND', 'Record not found', 404); // адверс-ревью #1: не fail-open на objectId=''
  const rawIds = parseMentionIds(body);
  const { valid, skipped } = await validateMentions(orgId, record.objectId, rawIds);
  const comment = await prisma.comment.update({ where: { id: existing.id }, data: { body, editedAt: new Date() } });
  await prisma.commentMention.deleteMany({ where: { commentId: existing.id } });
  if (valid.length) await prisma.commentMention.createMany({ data: valid.map((uid) => ({ orgId, commentId: existing.id, userId: uid })), skipDuplicates: true });
  // новые упоминания (которых не было) → notify. Для простоты M22-1: notify всем валидным (dedupeKey не плодит повтор).
  const recordName = record.displayName ?? 'a record';
  for (const uid of valid) { if (uid === actor.userId) continue; await notify({ orgId, source: 'SYSTEM', type: 'MENTION', title: `You were mentioned on ${recordName}`, body: body.slice(0, 140), entityType: 'record', entityId: recordId, dedupeKey: `mention:${existing.id}:${uid}`, recipientUserIds: [uid] }); }
  return { comment, mentions: valid, mentionsSkipped: skipped };
}

// soft-delete (правка GPT): тред цел, deep-link reply не падает. Автор ИЛИ admin/owner.
export async function deleteComment(orgId: string, recordId: string, commentId: string, actor: { userId: string; isManager: boolean }) {
  const existing = await prisma.comment.findFirst({ where: { id: commentId, orgId, recordId, deletedAt: null }, select: { id: true, authorId: true } });
  if (!existing) throw new CommentError('COMMENT_NOT_FOUND', 'Comment not found', 404);
  if (existing.authorId !== actor.userId && !actor.isManager) throw new CommentError('NOT_ALLOWED', 'You can only delete your own comment', 403);
  await prisma.comment.update({ where: { id: existing.id }, data: { deletedAt: new Date(), deletedById: actor.userId, body: '' } });
  return { ok: true };
}

// Кого можно @упомянуть на этой записи: активные члены org с READ к объекту записи (RBAC-aware автокомплит).
export async function mentionableUsers(orgId: string, objectId: string): Promise<{ id: string; name: string; email: string }[]> {
  const members = await prisma.user.findMany({ where: { orgId, isActive: true }, select: { id: true, name: true, email: true, role: true } });
  const out: { id: string; name: string; email: string }[] = [];
  for (const m of members) {
    const lvl = await resolveAccess(orgId, { userId: m.id, role: m.role }, 'OBJECT', objectId);
    if (meets(lvl, 'READ')) out.push({ id: m.id, name: m.name, email: m.email });
  }
  return out;
}

// Список комментов записи (корни + ответы), soft-deleted → плейсхолдер. + авторы + mentions + mentionable.
export async function listComments(orgId: string, recordId: string) {
  const record = await prisma.record.findFirst({ where: { id: recordId, orgId }, select: { objectId: true } });
  const mentionable = record ? await mentionableUsers(orgId, record.objectId) : [];
  const comments = await prisma.comment.findMany({ where: { orgId, recordId }, orderBy: { createdAt: 'asc' }, include: { mentions: { select: { userId: true } } } });
  const userIds = [...new Set([...comments.map((c) => c.authorId), ...comments.flatMap((c) => c.mentions.map((m) => m.userId)), ...comments.map((c) => c.deletedById).filter(Boolean) as string[]])];
  const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds }, orgId }, select: { id: true, name: true, email: true } }) : [];
  const uMap = new Map(users.map((u) => [u.id, { id: u.id, name: u.name, email: u.email }]));
  const shape = (c: typeof comments[number]) => ({
    id: c.id, parentId: c.parentId, authorId: c.authorId, author: uMap.get(c.authorId) ?? null,
    body: c.deletedAt ? '' : c.body, deleted: !!c.deletedAt, editedAt: c.editedAt, createdAt: c.createdAt,
    mentions: c.mentions.map((m) => uMap.get(m.userId)).filter(Boolean),
  });
  const roots = comments.filter((c) => !c.parentId).map((c) => ({ ...shape(c), replies: comments.filter((r) => r.parentId === c.id).map(shape) }));
  return { comments: roots, users, mentionable };
}
