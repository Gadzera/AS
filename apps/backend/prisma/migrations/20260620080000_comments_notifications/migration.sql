-- M22-1: Comments + @mentions + per-user notification recipients (S396/S397/S398).

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('MENTION', 'REPLY', 'TASK_ASSIGNED', 'RECORD_ASSIGNED', 'SYSTEM');

-- AlterTable: Notification.type
ALTER TABLE "crm_notifications" ADD COLUMN "type" "NotificationType" NOT NULL DEFAULT 'SYSTEM';
CREATE INDEX "crm_notifications_orgId_type_idx" ON "crm_notifications"("orgId", "type");

-- CreateTable: NotificationRecipient (per-user read-state)
CREATE TABLE "crm_notification_recipients" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_notification_recipients_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "crm_notification_recipients_notificationId_userId_key" ON "crm_notification_recipients"("notificationId", "userId");
CREATE INDEX "crm_notification_recipients_orgId_userId_readAt_idx" ON "crm_notification_recipients"("orgId", "userId", "readAt");
ALTER TABLE "crm_notification_recipients" ADD CONSTRAINT "crm_notification_recipients_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "crm_notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: Comment
CREATE TABLE "crm_comments" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "parentId" TEXT,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_comments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "crm_comments_orgId_recordId_idx" ON "crm_comments"("orgId", "recordId");
CREATE INDEX "crm_comments_parentId_idx" ON "crm_comments"("parentId");

-- CreateTable: CommentMention
CREATE TABLE "crm_comment_mentions" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_comment_mentions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "crm_comment_mentions_commentId_userId_key" ON "crm_comment_mentions"("commentId", "userId");
CREATE INDEX "crm_comment_mentions_orgId_userId_idx" ON "crm_comment_mentions"("orgId", "userId");
ALTER TABLE "crm_comment_mentions" ADD CONSTRAINT "crm_comment_mentions_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "crm_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
