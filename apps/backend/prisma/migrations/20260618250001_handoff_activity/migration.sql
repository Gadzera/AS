-- M15-3: тип активности для аудита пакета передачи (created/updated/viewed/assigned/handed_off в payload.action).
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'HANDOFF_PACKAGE';
