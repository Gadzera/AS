-- M14-1: intent-классификация входящего ответа (intent=replyClass; confidence 0..1; source AUTO|HUMAN).
CREATE TYPE "ReplyIntentSource" AS ENUM ('AUTO', 'HUMAN');

ALTER TABLE "Message" ADD COLUMN "intentConfidence" DOUBLE PRECISION;
ALTER TABLE "Message" ADD COLUMN "intentClassifiedAt" TIMESTAMP(3);
ALTER TABLE "Message" ADD COLUMN "intentSource" "ReplyIntentSource";
