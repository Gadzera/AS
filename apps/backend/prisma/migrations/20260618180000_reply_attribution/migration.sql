-- M13-3: точная атрибуция входящего ответа к конкретному outbound Message.
ALTER TABLE "Message" ADD COLUMN "replyToMessageId" TEXT;
ALTER TABLE "Message" ADD COLUMN "attributionMode" TEXT;
CREATE INDEX "Message_replyToMessageId_idx" ON "Message" ("replyToMessageId");
