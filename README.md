# SDR Agent — B2B Sales Automation SaaS

## Что это такое / What is this

**RU:** SDR Agent — это платформа автоматизации B2B продаж, которая:
- Ищет и обогащает лиды через Apollo.io
- Генерирует персонализированные email/LinkedIn сообщения
- Автоматически ведёт email-последовательности
- Классифицирует ответы и скорит лидов
- Управляет кампаниями, инбоксом и аналитикой

**EN:** SDR Agent is a B2B sales automation platform that:
- Finds and enriches leads via Apollo.io
- Generates personalized email/LinkedIn outreach messages
- Automates email sequence campaigns
- Classifies replies and scores leads
- Provides inbox management, campaign analytics, and CRM sync

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js + Express + TypeScript |
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| Database | PostgreSQL + Prisma ORM |
| Auth | JWT + bcrypt |
| Message generation | LLM API |
| Email | Nodemailer / SMTP rotation |
| Payments | Stripe |
| Lead Data | Apollo.io API |
| LinkedIn | Unipile API |
| Queue | BullMQ + Redis |
| Images | @napi-rs/canvas (self-hosted) |

---

## Запуск / Running

### One-command start (Docker)
```bash
cp apps/backend/.env.example apps/backend/.env
# Edit apps/backend/.env with your keys
docker-compose up -d
```

Services start automatically:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- PostgreSQL: localhost:5432
- Redis: localhost:6379

### Local development
```bash
# Prerequisites: Node.js 18+, Docker
npm install
docker-compose up -d postgres redis
npm run db:migrate
npm run db:generate
npm run dev
```

### Required environment variables
- `ANTHROPIC_API_KEY` — message generation
- `APOLLO_API_KEY` — lead search
- `STRIPE_SECRET_KEY` — payments
- `UNIPILE_API_KEY` + `UNIPILE_DSN` — LinkedIn

---

## API Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/register | Register new user + org |
| POST | /api/auth/login | Login, returns JWT |
| GET | /api/auth/me | Current user profile |

### Leads
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/leads | List leads (paginated, filtered) |
| POST | /api/leads | Create lead manually |
| PUT | /api/leads/:id | Update lead |
| DELETE | /api/leads/:id | Delete lead |
| POST | /api/leads/import | CSV import with deduplication |
| POST | /api/leads/bulk | Bulk actions (delete/campaign/export) |
| POST | /api/leads/search | Search via Apollo.io |
| POST | /api/leads/:id/enrich | Enrich lead data |

### Campaigns
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/campaigns | List campaigns |
| POST | /api/campaigns | Create campaign |
| PUT | /api/campaigns/:id | Update campaign |
| DELETE | /api/campaigns/:id | Delete campaign |
| POST | /api/campaigns/:id/start | Start campaign |
| POST | /api/campaigns/:id/pause | Pause campaign |
| POST | /api/campaigns/:id/add-leads | Enroll leads |

### Inbox
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/inbox | Conversation list |
| GET | /api/inbox/:leadId | Full thread |
| POST | /api/inbox/:leadId/reply | Send reply |
| PATCH | /api/inbox/:leadId/status | Update lead status |

### Analytics
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/analytics/stats | Overview stats |
| GET | /api/analytics/campaign/:id | Campaign stats |
| GET | /api/analytics/ab/:campaignId | A/B test results |

### Tracking
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/track/open/:messageId | Email open pixel |
| GET | /api/track/click/:messageId/:url | Click redirect |
| GET | /api/track/unsubscribe/:token | Unsubscribe handler |

### Personalization
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/personalization/image | Personalized image (public) |
| POST | /api/personalization/spam-check | Email spam score check |

### CRM
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/crm/status | HubSpot/Pipedrive connection status |
| POST | /api/crm/sync/:leadId | Sync single lead |
| POST | /api/crm/sync-batch | Sync all HOT leads |

---

## Project Structure

```
apps/
├── backend/
│   ├── prisma/         # Schema & migrations
│   └── src/
│       ├── config.ts
│       ├── routes/     # Express routers
│       ├── services/   # Business logic
│       ├── utils/      # Helpers
│       └── worker/     # BullMQ job processor
└── frontend/
    └── src/
        ├── app/        # Next.js App Router pages
        ├── components/ # Reusable UI components
        ├── lib/        # API client, auth helpers
        └── types/      # TypeScript types
```
