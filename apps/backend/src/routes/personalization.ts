import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { generatePersonalizedImageLocal, TemplateId } from '../services/imagePersonalization';
import { checkSpamScore } from '../utils/spamScore';
import { authenticate, requireOrg } from '../middleware/auth';

const router = Router();

// GET /api/personalization/image — public endpoint, no auth (email clients fetch it)
// ?n=FirstName&c=Company&t=Title&tp=1|2|3
router.get('/image', async (req: Request, res: Response) => {
  const firstName = String(req.query.n ?? 'Friend').slice(0, 40);
  const company   = String(req.query.c ?? '').slice(0, 50);
  const title     = String(req.query.t ?? '').slice(0, 50);
  const template  = (['1', '2', '3'].includes(String(req.query.tp)) ? req.query.tp : '1') as TemplateId;

  try {
    const buf = await generatePersonalizedImageLocal({ firstName, company, title, template });

    res.set({
      'Content-Type':  'image/png',
      'Content-Length': buf.length.toString(),
      'Cache-Control': 'public, max-age=7200, immutable',
    });
    res.send(buf);
  } catch (err) {
    // Fail silently — return 1×1 transparent PNG so email still renders
    const blank = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
    res.set('Content-Type', 'image/png').send(blank);
  }
});

const spamCheckSchema = z.object({
  subject: z.string().max(500).optional().default(''),
  body: z.string().max(50000).optional().default(''),
});

// POST /api/personalization/spam-check — check a subject+body for spam score (auth required)
router.post('/spam-check', authenticate, requireOrg, (req: Request, res: Response, next: NextFunction) => {
  try {
    const { subject, body } = spamCheckSchema.parse(req.body);
    if (!subject && !body) { res.status(400).json({ error: 'Provide subject and/or body' }); return; }
    res.json(checkSpamScore(subject, body));
  } catch (err) { next(err); }
});

// GET /api/personalization/templates — list available templates (auth required)
router.get('/templates', authenticate, requireOrg, (_req: Request, res: Response) => {
  res.json([
    { id: '1', name: 'Modern Dark',   preview: 'Dark background with indigo accent' },
    { id: '2', name: 'Clean Light',   preview: 'White background, professional look' },
    { id: '3', name: 'Bold Purple',   preview: 'Dark with purple gradient accent' },
  ]);
});

export default router;
