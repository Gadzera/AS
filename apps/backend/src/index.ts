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

import objectsRouter from './routes/objects';

import recordsRouter from './routes/records';

import viewsRouter from './routes/views';

import crmRouter from './routes/crm';

const app = express();

// Middleware безопасности

app.use(helmet());

app.use(
  cors({
    origin: config.frontendUrl,

    credentials: true,
  })
);

// Ограничение частоты запросов

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  max: 200,

  standardHeaders: true,

  legacyHeaders: false,
});

app.use(limiter);

// Raw body для Stripe webhooks должен быть подключён до json middleware

app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

// Парсинг JSON body

app.use(express.json({ limit: '10mb' }));

app.use(express.urlencoded({ extended: true }));

// Health check

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Маршруты API

app.use('/api/auth', authRouter);

app.use('/api/leads', leadsRouter);

app.use('/api/campaigns', campaignsRouter);

app.use('/api/sequences', sequencesRouter);

app.use('/api/outreach', outreachRouter);

app.use('/api/analytics', analyticsRouter);

app.use('/api/billing', billingRouter);

app.use('/api/track', trackRouter);

app.use('/api/objects', objectsRouter);

app.use('/api/records', recordsRouter);

app.use('/api/views', viewsRouter);

app.use('/api/crm', crmRouter);

// Обработчик 404

app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Обработчик ошибок

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`[Server] Running on http://localhost:${config.port}`);

  console.log(`[Server] Environment: ${config.nodeEnv}`);
});

export default app;