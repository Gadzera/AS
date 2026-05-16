import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import IORedis from 'ioredis';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';

import authRouter from './routes/auth';
import leadsRouter from './routes/leads';
import campaignsRouter from './routes/campaigns';
import sequencesRouter from './routes/sequences';
import outreachRouter from './routes/outreach';
import analyticsRouter from './routes/analytics';
import billingRouter from './routes/billing';
import trackRouter from './routes/track';
import smtpRouter from './routes/smtp';
import webhooksRouter from './routes/webhooks';
import deliverabilityRouter from './routes/deliverability';
import crmRouter from './routes/crm';
import bannerbearRouter from './routes/bannerbear';
import personalizationRouter from './routes/personalization';
import inboxRouter from './routes/inbox';
import templatesRouter from './routes/templates';
import notificationsRouter from './routes/notifications';
import referralRouter from './routes/referral';
import autopilotRouter from './routes/autopilot';
import teamRouter from './routes/team';
import organizationRouter from './routes/organization';
import tagsRouter from './routes/tags';

const app = express();

// Shared Redis client for rate limiting (separate from BullMQ client)
const rateLimitRedis = new IORedis(config.redis.url, { enableReadyCheck: false, lazyConnect: true });
rateLimitRedis.on('error', (err) => console.error('[RateLimit Redis]', err.message));

function makeRedisStore(prefix: string) {
  return new RedisStore({
    sendCommand: (...args: string[]) => rateLimitRedis.call(args[0], ...args.slice(1)) as Promise<number>,
    prefix,
  });
}

// Trust reverse proxy (nginx/ALB) so rate limiter reads real client IP
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/personalization')) { return next(); }
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  return next();
});
app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
  })
);

// Global rate limit — Redis-backed, works across replicas
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeRedisStore('rl:global:'),
});
app.use(limiter);

// Stricter limit on auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, try again later' },
  store: makeRedisStore('rl:auth:'),
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Strict limit on AI generation endpoints (cost protection)
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as Request & { user?: { userId?: string } }).user?.userId ?? req.ip ?? 'anon',
  message: { error: 'Too many generation requests, please wait' },
  store: makeRedisStore('rl:ai:'),
});
app.use('/api/outreach/generate', aiLimiter);
app.use('/api/outreach/auto-reply', aiLimiter);
app.use('/api/bannerbear/preview', aiLimiter);

// Limit on external paid API endpoints
const externalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as Request & { user?: { orgId?: string } }).user?.orgId ?? req.ip ?? 'anon',
  message: { error: 'Too many requests to external API, please wait' },
  store: makeRedisStore('rl:ext:'),
});
app.use('/api/leads/search', externalApiLimiter);

// Rate limit on public tracking endpoints
const trackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeRedisStore('rl:track:'),
});
app.use('/api/track', trackLimiter);

// Parse raw body for Stripe webhooks BEFORE json middleware
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

// JSON body parsing
app.use(express.json({ limit: '10mb' }));
app.use((err: SyntaxError & { status?: number }, _req: Request, res: Response, next: NextFunction) => {
  if (err.status === 400 && 'body' in err) {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }
  next(err);
});
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/sequences', sequencesRouter);
app.use('/api/outreach', outreachRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/billing', billingRouter);
app.use('/api/track', trackRouter);
app.use('/api/smtp', smtpRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/deliverability', deliverabilityRouter);
app.use('/api/crm', crmRouter);
app.use('/api/bannerbear', bannerbearRouter);
app.use('/api/personalization', personalizationRouter);
app.use('/api/inbox', inboxRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/referral', referralRouter);
app.use('/api/autopilot', autopilotRouter);
app.use('/api/team', teamRouter);
app.use('/api/organization', organizationRouter);
app.use('/api/tags', tagsRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use(errorHandler);

if (!process.env.BACKEND_URL) {
  console.warn('[Config] BACKEND_URL is not set — tracking pixels and unsubscribe links in emails will point to localhost');
}

app.listen(config.port, () => {
  console.log(`[Server] Running on http://localhost:${config.port}`);
  console.log(`[Server] Environment: ${config.nodeEnv}`);
});

export default app;
