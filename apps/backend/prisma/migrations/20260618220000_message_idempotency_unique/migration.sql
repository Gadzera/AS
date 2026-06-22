-- M14-4: UNIQUE на Message.idempotencyKey → один OUTBOUND на ключ.
-- Sequence-ключи `${campaignLeadId}:${sequenceId}` уже уникальны; reply-send ключ `reply-draft:<draftId>`.
-- NULL допускают много строк (Postgres трактует NULL как различные в UNIQUE-индексе).
CREATE UNIQUE INDEX "Message_idempotencyKey_key" ON "Message"("idempotencyKey");
