-- M15-2: тип активности «встреча назначена» (отдельный файл — ALTER TYPE ADD VALUE нельзя в одной транзакции с использованием).
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'MEETING_SCHEDULED';
