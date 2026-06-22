import { PrismaClient, SendSkipReason } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Записать пропуск отправки воркером — делает прозрачным, почему агент не отправил.
 * Дедуп: один и тот же (leadId, reason) не пишется чаще раза в 60 минут, чтобы
 * почасовые ретраи воркера не засоряли ленту. Ошибки глушим — это не должно
 * ронять основной цикл отправки.
 */
export async function recordSendSkip(params: {
  orgId: string;
  campaignId?: string | null;
  leadId?: string | null;
  reason: SendSkipReason;
  detail?: string | null;
}): Promise<void> {
  try {
    const { orgId, campaignId, leadId, reason, detail } = params;
    if (leadId) {
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const dup = await prisma.sendSkip.findFirst({
        where: { orgId, leadId, reason, createdAt: { gte: hourAgo } },
        select: { id: true },
      });
      if (dup) return;
    }
    await prisma.sendSkip.create({
      data: { orgId, campaignId: campaignId ?? null, leadId: leadId ?? null, reason, detail: detail ?? null },
    });
  } catch {
    /* запись пропуска не критична — не мешаем основному циклу */
  }
}
