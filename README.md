# AI SDR Agent — B2B Sales Automation SaaS

## Что это такое / What is this

**RU:** AI SDR Agent — это платформа автоматизации B2B продаж, которая использует искусственный интеллект (Claude от Anthropic) для:
- Поиска и обогащения лидов через Apollo.io
- Генерации персонализированных email/LinkedIn сообщений
- Автоматического ведения email-последовательностей
- Классификации ответов и скоринга лидов
- Управления кампаниями и аналитики

**EN:** AI SDR Agent is a B2B sales automation platform powered by Claude AI that:
- Finds and enriches leads via Apollo.io
- Generates personalized email/LinkedIn outreach messages
- Automates email sequence campaigns
- Classifies replies and scores leads
- Provides campaign management and analytics

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js + Express + TypeScript |
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| Database | PostgreSQL + Prisma ORM |
| Auth | JWT + bcrypt |
| AI | Anthropic Claude (claude-sonnet-4-6) |
| Email | Nodemailer / SMTP |
| Payments | Stripe |
| Lead Data | Apollo.io API |
| LinkedIn | Unipile API |
| Cache | Redis |

---

## Запуск локально / Running Locally

### 1. Prerequisites
- Node.js 18+
- Docker + Docker Compose
- npm 9+

### 2. Clone & Install
```bash
git clone <repo-url>
cd ai-sdr-agent
npm install
```

### 3. Environment Variables
```bash
cp .env.example .env
# Edit .env with your actual API keys
```

Required keys:
- `ANTHROPIC_API_KEY` — from https://console.anthropic.com
- `APOLLO_API_KEY` — from https://app.apollo.io/#/settings/integrations/api
- `STRIPE_SECRET_KEY` — from https://dashboard.stripe.com/apikeys
- `UNIPILE_API_KEY` + `UNIPILE_DSN` — from https://unipile.com

### 4. Start Database
```bash
docker-compose up -d
```

### 5. Run Migrations
```bash
npm run db:migrate
npm run db:generate
```

### 6. Start Development Servers
```bash
npm run dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

---

## API Endpoints Overview

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
| GET | /api/leads/:id | Get single lead |
| PUT | /api/leads/:id | Update lead |
| DELETE | /api/leads/:id | Delete lead |
| POST | /api/leads/search | Search via Apollo.io |
| POST | /api/leads/:id/enrich | Enrich lead data |

### Campaigns
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/campaigns | List campaigns |
| POST | /api/campaigns | Create campaign |
| GET | /api/campaigns/:id | Get campaign details |
| PUT | /api/campaigns/:id | Update campaign |
| DELETE | /api/campaigns/:id | Delete campaign |
| POST | /api/campaigns/:id/start | Start campaign |
| POST | /api/campaigns/:id/pause | Pause campaign |

### Sequences
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/sequences/:campaignId | Get sequence steps |
| POST | /api/sequences/:campaignId | Add step |
| PUT | /api/sequences/:id | Update step |
| DELETE | /api/sequences/:id | Delete step |

### Outreach (AI)
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/outreach/generate | Generate AI message |
| POST | /api/outreach/classify | Classify reply |

### Analytics
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/analytics/stats | Overview stats |
| GET | /api/analytics/campaign/:id | Campaign stats |

### Billing
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/billing/checkout | Create Stripe checkout |
| POST | /api/billing/webhook | Stripe webhook handler |
| GET | /api/billing/subscription | Current subscription |

---

## Project Structure

```
ai-sdr-agent/
├── apps/
│   ├── backend/          # Express + TypeScript API
│   │   ├── prisma/       # Database schema & migrations
│   │   └── src/
│   │       ├── middleware/
│   │       ├── routes/
│   │       └── services/
│   └── frontend/         # Next.js 14 App Router
│       └── src/
│           ├── app/       # Pages (App Router)
│           ├── components/
│           ├── lib/
│           └── types/
├── docker-compose.yml
├── .env.example
└── package.json
```

---

## License

MIT
