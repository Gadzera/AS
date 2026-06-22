-- M28-1/M28-2: шаблоны писем (EmailTemplate) + привязка письма к шаблону + ключ идемпотентности compose/send.

-- Новая таблица шаблонов писем (org-scoped).
CREATE TABLE "crm_email_templates" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "crm_email_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "crm_email_templates_orgId_idx" ON "crm_email_templates"("orgId");
CREATE INDEX "crm_email_templates_createdById_idx" ON "crm_email_templates"("createdById");

ALTER TABLE "crm_email_templates" ADD CONSTRAINT "crm_email_templates_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_email_templates" ADD CONSTRAINT "crm_email_templates_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Письмо: ссылка на шаблон + ключ идемпотентности compose/draft/send.
ALTER TABLE "crm_emails" ADD COLUMN "templateId" TEXT;
ALTER TABLE "crm_emails" ADD COLUMN "idempotencyKey" TEXT;

CREATE INDEX "crm_emails_templateId_idx" ON "crm_emails"("templateId");
-- Один Email на (orgId, idempotencyKey); NULL допускает много (compose без ключа / старые письма).
CREATE UNIQUE INDEX "crm_emails_orgId_idempotencyKey_key" ON "crm_emails"("orgId", "idempotencyKey");

ALTER TABLE "crm_emails" ADD CONSTRAINT "crm_emails_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "crm_email_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
