-- M11-3: типы аудит-активностей для паузы/возобновления enrollment'а (видны в таймлайне Lead 360).
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'SEQUENCE_PAUSED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'SEQUENCE_RESUMED';
