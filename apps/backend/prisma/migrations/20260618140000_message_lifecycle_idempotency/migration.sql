-- M12-1/M12-2: идемпотентность отправки шага + жизненный цикл сообщения.

-- 1. Enum статуса сообщения.
CREATE TYPE "MessageStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'FAILED', 'SKIPPED');

-- 2. Новые поля (существующие строки → SENT: они уже отправлены).
ALTER TABLE "Message" ADD COLUMN "campaignLeadId" TEXT;
ALTER TABLE "Message" ADD COLUMN "sequenceId" TEXT;
ALTER TABLE "Message" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "Message" ADD COLUMN "status" "MessageStatus" NOT NULL DEFAULT 'SENT';
ALTER TABLE "Message" ADD COLUMN "providerMessageId" TEXT;
ALTER TABLE "Message" ADD COLUMN "error" TEXT;

-- 3. Составной unique (source-of-truth идемпотентности). Старые строки имеют (NULL,NULL) — в Postgres
--    NULL'ы в UNIQUE считаются различными, поэтому конфликта среди существующих сообщений нет.
CREATE UNIQUE INDEX "Message_campaignLeadId_sequenceId_key" ON "Message" ("campaignLeadId", "sequenceId");

-- 4. Индекс по статусу.
CREATE INDEX "Message_status_idx" ON "Message" ("status");
