-- M11-4: учёт паузы кампании для warmup. pausedAt — текущая пауза; pausedDaysAccum — накопленные
-- дни простоя, исключаемые из возраста кампании при расчёте warmup-лимита отправки.
ALTER TABLE "Campaign" ADD COLUMN "pausedAt" TIMESTAMP(3);
ALTER TABLE "Campaign" ADD COLUMN "pausedDaysAccum" DOUBLE PRECISION NOT NULL DEFAULT 0;
