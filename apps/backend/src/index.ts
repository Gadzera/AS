import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
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

const app = express();

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Parse raw body for Stripe webhooks BEFORE json middleware
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

// JSON body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`[Server] Running on http://localhost:${config.port}`);
  console.log(`[Server] Environment: ${config.nodeEnv}`);
});

export default app;
