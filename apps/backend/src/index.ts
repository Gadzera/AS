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
import commentsRouter from './routes/comments';
import notesRouter from './routes/notes';
import tasksRouter from './routes/tasks';
import recordPanelsRouter from './routes/recordPanels';
import emailComposeRouter from './routes/emailCompose';
import emailTemplatesRouter from './routes/emailTemplates';
import emailsRouter from './routes/emails';
import bulkRouter from './routes/bulk';

import viewsRouter from './routes/views';

import listsRouter from './routes/lists';

import meetingsRouter from './routes/meetings';

import crmRouter from './routes/crm';

import { aiRouter, attributeAiRouter, creditsRouter } from './routes/ai';
import { aiReviewRouter } from './routes/aiReview';

import overviewRouter from './routes/overview';

import teamRouter from './routes/team';

import insightsRouter from './routes/insights';

import playbooksRouter from './routes/playbooks';

import settingsRouter from './routes/settings';

import workflowsRouter from './routes/workflows';

import callsRouter from './routes/calls';

import notificationsRouter from './routes/notifications';

import searchRouter from './routes/search';
import askRouter from './routes/ask';
import reportBuilderRouter from './routes/reportBuilder';
import callInsightTemplatesRouter from './routes/callInsightTemplates';
import importsRouter from './routes/imports';
import permissionsRouter from './routes/permissions';
import teamsRouter from './routes/teams';
import onboardingRouter from './routes/onboarding';
import securityRouter from './routes/security';

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

  // prod-лимит остаётся строгим (200/15мин); в dev поднимаем, чтобы не мешать локальным прогонам/тестам.
  max: process.env.NODE_ENV === 'production' ? 200 : 10000,

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
app.use('/api/records', commentsRouter); // M22-1: /:recordId/comments (после recordsRouter — не конфликтует с /:id)
app.use('/api/records', notesRouter);    // M27-2: /:recordId/notes
app.use('/api/records', tasksRouter);    // M27-2: /:recordId/tasks
app.use('/api/records', recordPanelsRouter); // M27-3: /:recordId/calls|emails
app.use('/api/records', emailComposeRouter); // M28-1/2: /:recordId/email-recipients|email-variables|emails(preview/compose)
app.use('/api/email-templates', emailTemplatesRouter); // M28-2: CRUD email templates
app.use('/api/emails', emailsRouter); // M28-3: global emails list + safe detail + hidden-count
app.use('/api/bulk', bulkRouter); // M28-4: bulk send-email/preview + enroll-sequence

app.use('/api/views', viewsRouter);

app.use('/api/lists', listsRouter);

app.use('/api/meetings', meetingsRouter);

app.use('/api/crm', crmRouter);

// AI-атрибуты (M2): запуск по записи/виду, статусы run/bulk-run, кредиты.
// creditsRouter монтируется ДО billingRouter был бы конфликт, но /api/billing/credits
// специфичнее — Express проверяет роутер по порядку, поэтому ставим выше уже подключённого
// billingRouter не требуется: billingRouter не содержит маршрута /credits и пропускает дальше.
app.use('/api/attributes/:attributeId/ai', attributeAiRouter);

app.use('/api/ai', aiRouter);
app.use('/api/ai', aiReviewRouter);

app.use('/api/billing/credits', creditsRouter);

app.use('/api/overview', overviewRouter);

app.use('/api/team', teamRouter);

app.use('/api/insights', insightsRouter);

app.use('/api/playbooks', playbooksRouter);

app.use('/api/settings', settingsRouter);

app.use('/api/workflows', workflowsRouter);

app.use('/api/calls', callsRouter);

app.use('/api/notifications', notificationsRouter);

app.use('/api/search', searchRouter);
app.use('/api/ask', askRouter);
app.use('/api/report-builder', reportBuilderRouter);
app.use('/api/call-insight-templates', callInsightTemplatesRouter);
app.use('/api/imports', importsRouter);
app.use('/api/permissions', permissionsRouter);
app.use('/api/teams', teamsRouter);
app.use('/api/onboarding', onboardingRouter);
app.use('/api/security', securityRouter);

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