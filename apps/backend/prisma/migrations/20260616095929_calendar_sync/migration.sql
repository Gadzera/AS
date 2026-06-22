-- CreateEnum
CREATE TYPE "CalendarSyncStatus" AS ENUM ('PENDING', 'SYNCED', 'FAILED', 'NOT_CONNECTED', 'CANCELED');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "calendarConnectedAt" TIMESTAMP(3),
ADD COLUMN     "calendarProvider" TEXT;

-- AlterTable
ALTER TABLE "crm_meetings" ADD COLUMN     "externalEventId" TEXT,
ADD COLUMN     "syncError" TEXT,
ADD COLUMN     "syncStatus" "CalendarSyncStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "syncedAt" TIMESTAMP(3);
