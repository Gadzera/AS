-- M15-4: тип активности для аудита исхода встречи (before/after в payload).
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'MEETING_OUTCOME';
