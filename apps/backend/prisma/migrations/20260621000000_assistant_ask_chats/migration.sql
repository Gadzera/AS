-- M26-1 Ask AISDR: per-user чаты ассистента + сохранённые pending-действия.

-- CreateEnum
CREATE TYPE "AssistantMessageRole" AS ENUM ('USER', 'ASSISTANT');
CREATE TYPE "AskActionKind" AS ENUM ('CREATE_TASK', 'UPDATE_RECORD', 'DRAFT_EMAIL', 'NAVIGATE');
CREATE TYPE "AskActionStatus" AS ENUM ('PENDING', 'APPLIED', 'DISMISSED');

-- CreateTable
CREATE TABLE "assistant_chats" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New chat',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    CONSTRAINT "assistant_chats_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assistant_messages" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "role" "AssistantMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "citations" JSONB,
    "generatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "assistant_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assistant_actions" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "AskActionKind" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "AskActionStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT,
    "appliedAt" TIMESTAMP(3),
    "appliedResult" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "assistant_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assistant_chats_orgId_userId_archivedAt_idx" ON "assistant_chats"("orgId", "userId", "archivedAt");
CREATE INDEX "assistant_messages_chatId_createdAt_idx" ON "assistant_messages"("chatId", "createdAt");
CREATE UNIQUE INDEX "assistant_actions_orgId_idempotencyKey_key" ON "assistant_actions"("orgId", "idempotencyKey");
CREATE INDEX "assistant_actions_chatId_idx" ON "assistant_actions"("chatId");

-- AddForeignKey
ALTER TABLE "assistant_chats" ADD CONSTRAINT "assistant_chats_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assistant_chats" ADD CONSTRAINT "assistant_chats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "assistant_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assistant_actions" ADD CONSTRAINT "assistant_actions_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assistant_actions" ADD CONSTRAINT "assistant_actions_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "assistant_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assistant_actions" ADD CONSTRAINT "assistant_actions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "assistant_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
