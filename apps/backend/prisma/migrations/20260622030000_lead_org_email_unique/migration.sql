-- M28-4: уникальность Lead по (orgId, email) — устраняет гонку дубля Lead при bulk enroll (Person→Lead-мост).
-- Postgres трактует NULL как различные значения, поэтому NULL-email лиды не конфликтуют. Дублей непустого email нет.
CREATE UNIQUE INDEX "Lead_orgId_email_key" ON "Lead"("orgId", "email");
