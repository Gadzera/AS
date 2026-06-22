-- M12-3: с какого ящика ушло исходящее (provider identity, per-mailbox capacity, Reports/M12-5).
ALTER TABLE "Message" ADD COLUMN "mailboxId" TEXT;
CREATE INDEX "Message_mailboxId_sentAt_idx" ON "Message" ("mailboxId", "sentAt");
