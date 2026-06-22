/**
 * Global Search — единый RBAC/org-scoped поиск для командной палитры (⌘K).
 *  GET /api/search?q=&limit= — ищет по всем ключевым сущностям воркспейса и
 *  возвращает сгруппированные результаты с deep-link на нужный экран:
 *    • leads      → /leads/:id        (Lead 360)
 *    • records    → /data?object=&record=  (Data Hub — companies/people/…)
 *    • campaigns  → /sequences?campaign=:id (Outreach / Sequences)
 *    • meetings   → /meetings
 *    • calls      → /calls
 *  Всё строго в пределах orgId пользователя — чужие сущности не находятся.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireOrg } from '../middleware/auth';
import { buildResolver, meets } from '../services/permissions';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate, requireOrg);

interface Hit { id: string; title: string; subtitle: string | null; meta: string | null; href: string }
interface Group { type: string; label: string; icon: string; items: Hit[] }

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const q = (typeof req.query.q === 'string' ? req.query.q : '').trim();
    const perType = Math.min(Math.max(Number(req.query.limit) || 6, 1), 10);
    if (q.length < 2) { res.json({ query: q, groups: [], total: 0 }); return; }

    const ci = { contains: q, mode: 'insensitive' as const };

    const [leads, records, campaigns, meetings, calls] = await Promise.all([
      prisma.lead.findMany({
        where: { orgId, OR: [{ firstName: ci }, { lastName: ci }, { email: ci }, { company: ci }, { title: ci }] },
        orderBy: { updatedAt: 'desc' }, take: perType,
        select: { id: true, firstName: true, lastName: true, title: true, company: true, status: true },
      }),
      prisma.record.findMany({
        where: { orgId, archivedAt: null, OR: [{ displayName: ci }, { searchText: ci }] },
        orderBy: { updatedAt: 'desc' }, take: perType * 3, // берём с запасом — отфильтруем по RBAC ниже
        select: { id: true, displayName: true, objectId: true, object: { select: { key: true, singularName: true } } },
      }),
      prisma.campaign.findMany({
        where: { orgId, name: ci },
        orderBy: { updatedAt: 'desc' }, take: perType,
        select: { id: true, name: true, status: true, channel: true, _count: { select: { campaignLeads: true } } },
      }),
      prisma.meeting.findMany({
        where: { orgId, archivedAt: null, OR: [{ title: ci }, { company: ci }] },
        orderBy: { createdAt: 'desc' }, take: perType,
        select: { id: true, title: true, company: true, status: true, scheduledAt: true },
      }),
      prisma.call.findMany({
        where: { orgId, archivedAt: null, OR: [{ notes: ci }, { summary: ci }] },
        orderBy: { createdAt: 'desc' }, take: perType,
        select: { id: true, direction: true, status: true, outcome: true, notes: true, leadId: true },
      }),
    ]);

    // RBAC: записи объектов и кампании (sequences) фильтруем по READ-доступу (S355 — скрытое не находится в поиске).
    const u = { userId: req.user!.userId, role: req.user!.role };
    const [objR, seqR] = await Promise.all([buildResolver(orgId, u, 'OBJECT'), buildResolver(orgId, u, 'SEQUENCE')]);
    const visRecords = records.filter((r) => meets(objR(r.objectId), 'READ')).slice(0, perType);
    const visCampaigns = campaigns.filter((c) => meets(seqR(c.id), 'READ'));

    // Имена лидов для звонков (у Call нет relation — подтягиваем отдельно).
    const callLeadIds = [...new Set(calls.map((c) => c.leadId).filter(Boolean) as string[])];
    const callLeads = callLeadIds.length
      ? await prisma.lead.findMany({ where: { id: { in: callLeadIds }, orgId }, select: { id: true, firstName: true, lastName: true } })
      : [];
    const callLeadMap = new Map(callLeads.map((l) => [l.id, `${l.firstName} ${l.lastName}`.trim()]));

    const groups: Group[] = [];

    if (leads.length) groups.push({
      type: 'lead', label: 'Leads', icon: 'user',
      items: leads.map((l) => ({
        id: l.id, title: `${l.firstName} ${l.lastName}`.trim() || 'Lead',
        subtitle: [l.title, l.company].filter(Boolean).join(' · ') || null, meta: l.status,
        href: `/leads/${l.id}`,
      })),
    });

    if (visRecords.length) groups.push({
      type: 'record', label: 'Records', icon: 'database',
      items: visRecords.map((r) => ({
        id: r.id, title: r.displayName || 'Untitled',
        subtitle: r.object?.singularName ?? null, meta: null,
        href: `/data?object=${encodeURIComponent(r.object?.key ?? 'companies')}&record=${encodeURIComponent(r.id)}`,
      })),
    });

    if (visCampaigns.length) groups.push({
      type: 'campaign', label: 'Sequences', icon: 'send',
      items: visCampaigns.map((c) => ({
        id: c.id, title: c.name,
        subtitle: `${c._count.campaignLeads} enrolled`, meta: c.status,
        href: `/sequences?campaign=${c.id}`,
      })),
    });

    if (meetings.length) groups.push({
      type: 'meeting', label: 'Meetings', icon: 'calendar',
      items: meetings.map((m) => ({
        id: m.id, title: m.title,
        subtitle: m.company || (m.scheduledAt ? new Date(m.scheduledAt).toLocaleString() : null), meta: m.status,
        href: `/meetings`,
      })),
    });

    if (calls.length) groups.push({
      type: 'call', label: 'Calls', icon: 'phone',
      items: calls.map((c) => ({
        id: c.id, title: c.leadId && callLeadMap.get(c.leadId) ? callLeadMap.get(c.leadId)! : `Call · ${c.direction.toLowerCase()}`,
        subtitle: (c.notes || '').slice(0, 60) || null, meta: c.outcome ?? c.status,
        href: `/calls`,
      })),
    });

    const total = groups.reduce((n, g) => n + g.items.length, 0);
    res.json({ query: q, groups, total });
  } catch (err) { next(err); }
});

export default router;
