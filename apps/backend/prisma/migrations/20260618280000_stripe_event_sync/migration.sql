-- M16-2: Stripe subscription sync — дедуп вебхуков со статусом + поля подписки на org.
CREATE TYPE "StripeEventStatus" AS ENUM ('PROCESSING', 'PROCESSED', 'FAILED');

CREATE TABLE "stripe_events" (
  "id"          TEXT NOT NULL,
  "eventId"     TEXT NOT NULL,
  "type"        TEXT NOT NULL,
  "status"      "StripeEventStatus" NOT NULL DEFAULT 'PROCESSING',
  "attempts"    INTEGER NOT NULL DEFAULT 0,
  "error"       TEXT,
  "payload"     JSONB,
  "processedAt" TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "stripe_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "stripe_events_eventId_key" ON "stripe_events"("eventId");
CREATE INDEX "stripe_events_status_idx" ON "stripe_events"("status");

ALTER TABLE "Organization" ADD COLUMN "subscriptionStatus" TEXT;
ALTER TABLE "Organization" ADD COLUMN "currentPeriodEnd"   TIMESTAMP(3);
ALTER TABLE "Organization" ADD COLUMN "cancelAtPeriodEnd"  BOOLEAN NOT NULL DEFAULT false;
