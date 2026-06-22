import { Router, Request, Response } from 'express';
import { isBotUserAgent, recordOpenEvent, recordBounceEvent } from '../services/tracking';

const router = Router();

// 1x1 transparent GIF
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

// GET /api/track/open/:messageId — пиксель открытия.
// M13-2: бот/прокси (UA-денилист) → отдаём пиксель, но событие НЕ пишем; человек → идемпотентный OPENED
// MessageEvent (только для существующего Message). Пиксель отдаётся ВСЕГДА (fire-and-forget по записи).
router.get('/open/:messageId', (req: Request, res: Response) => {
  const { messageId } = req.params;
  const ua = req.get('user-agent') ?? '';
  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req.ip || null;

  if (!isBotUserAgent(ua)) {
    void recordOpenEvent(messageId, ua, ip).catch(() => {}); // не блокируем пиксель; ошибки/unknown — тихо
  }

  res.set({
    'Content-Type': 'image/gif',
    'Content-Length': PIXEL.length,
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    Pragma: 'no-cache',
  });
  res.send(PIXEL);
});

// POST /api/track/bounce — webhook отскока от провайдера (M13-4). Без auth (вызов от ESP); ищем отскочившее
// outbound по providerMessageId, пишем BOUNCED event и запускаем триггер BOUNCED scoped к его кампании.
router.post('/bounce', async (req: Request, res: Response) => {
  const { providerMessageId, bounceType, reason, providerEventId } = (req.body ?? {}) as Record<string, string | undefined>;
  if (!providerMessageId) { res.status(400).json({ error: 'providerMessageId required' }); return; }
  const result = await recordBounceEvent({ providerMessageId, bounceType, reason, providerEventId }).catch(() => 'error' as const);
  res.json({ ok: result !== 'unknown' && result !== 'error', result });
});

export default router;
