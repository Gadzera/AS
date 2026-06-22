-- M14-1: аудит ручной смены intent (set-class human override).
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'REPLY_INTENT_CHANGED';
