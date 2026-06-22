-- M26-2: Prompt Library + внутренние черновики писем для Ask AISDR

-- enums
CREATE TYPE "SavedPromptScope" AS ENUM ('PERSONAL', 'WORKSPACE');
CREATE TYPE "AskEmailDraftStatus" AS ENUM ('DRAFT', 'DISCARDED');

-- assistant_saved_prompts
CREATE TABLE "assistant_saved_prompts" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" "SavedPromptScope" NOT NULL DEFAULT 'PERSONAL',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "assistant_saved_prompts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "assistant_saved_prompts_orgId_scope_archivedAt_idx" ON "assistant_saved_prompts"("orgId", "scope", "archivedAt");
CREATE INDEX "assistant_saved_prompts_orgId_userId_idx" ON "assistant_saved_prompts"("orgId", "userId");
ALTER TABLE "assistant_saved_prompts" ADD CONSTRAINT "assistant_saved_prompts_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assistant_saved_prompts" ADD CONSTRAINT "assistant_saved_prompts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- assistant_email_drafts
CREATE TABLE "assistant_email_drafts" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leadId" TEXT,
    "recordId" TEXT,
    "toName" TEXT,
    "toEmail" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "AskEmailDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceActionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assistant_email_drafts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "assistant_email_drafts_orgId_userId_idx" ON "assistant_email_drafts"("orgId", "userId");
ALTER TABLE "assistant_email_drafts" ADD CONSTRAINT "assistant_email_drafts_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assistant_email_drafts" ADD CONSTRAINT "assistant_email_drafts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
