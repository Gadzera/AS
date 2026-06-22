-- M12-4: retry/backoff + recovery зависшего SENDING + терминальный сбой отправки.
ALTER TABLE "Message" ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Message" ADD COLUMN "sendingAt" TIMESTAMP(3);
ALTER TABLE "Message" ADD COLUMN "permanentFailure" BOOLEAN NOT NULL DEFAULT false;

ALTER TYPE "SendSkipReason" ADD VALUE IF NOT EXISTS 'SEND_FAILED';
