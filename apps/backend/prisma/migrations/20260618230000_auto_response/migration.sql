-- M14-5: auto-response (autopilot) — org-настройки + origin черновика ответа.
CREATE TYPE "ReplyDraftOrigin" AS ENUM ('MANUAL', 'AUTOPILOT', 'HANDOFF');

ALTER TABLE "Organization" ADD COLUMN "autoResponseEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN "autoResponseMinConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0.8;

ALTER TABLE "ReplyDraft" ADD COLUMN "origin" "ReplyDraftOrigin" NOT NULL DEFAULT 'MANUAL';
CREATE INDEX "ReplyDraft_orgId_origin_status_idx" ON "ReplyDraft"("orgId", "origin", "status");
