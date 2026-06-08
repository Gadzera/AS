-- CreateEnum
CREATE TYPE "AttributeType" AS ENUM ('TEXT', 'LONG_TEXT', 'NUMBER', 'BOOLEAN', 'DATE', 'DATETIME', 'SELECT', 'MULTI_SELECT', 'CURRENCY', 'EMAIL', 'PHONE', 'URL', 'USER', 'RELATIONSHIP', 'JSON');

-- CreateEnum
CREATE TYPE "RelationshipCardinality" AS ENUM ('ONE_TO_ONE', 'ONE_TO_MANY', 'MANY_TO_ONE', 'MANY_TO_MANY');

-- CreateEnum
CREATE TYPE "ViewType" AS ENUM ('TABLE', 'BOARD');

-- CreateEnum
CREATE TYPE "FilterOperator" AS ENUM ('EQUALS', 'NOT_EQUALS', 'CONTAINS', 'NOT_CONTAINS', 'STARTS_WITH', 'ENDS_WITH', 'IS_EMPTY', 'IS_NOT_EMPTY', 'GREATER_THAN', 'GREATER_THAN_OR_EQUAL', 'LESS_THAN', 'LESS_THAN_OR_EQUAL', 'BEFORE', 'AFTER', 'IN', 'NOT_IN');

-- CreateEnum
CREATE TYPE "SortDirection" AS ENUM ('ASC', 'DESC');

-- CreateEnum
CREATE TYPE "SystemField" AS ENUM ('ID', 'DISPLAY_NAME', 'CREATED_AT', 'UPDATED_AT', 'ARCHIVED_AT');

-- CreateEnum
CREATE TYPE "ListType" AS ENUM ('STATIC', 'DYNAMIC', 'PIPELINE');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('RECORD_CREATED', 'RECORD_UPDATED', 'RECORD_ARCHIVED', 'VALUE_UPDATED', 'RELATIONSHIP_CREATED', 'RELATIONSHIP_REMOVED', 'RECORD_ADDED_TO_LIST', 'RECORD_REMOVED_FROM_LIST', 'LIST_STAGE_CHANGED', 'NOTE_CREATED', 'NOTE_UPDATED', 'TASK_CREATED', 'TASK_COMPLETED', 'EMAIL_DRAFTED', 'EMAIL_SENT', 'EMAIL_OPENED', 'EMAIL_REPLIED', 'SEQUENCE_ENROLLED', 'SEQUENCE_EXITED', 'WORKFLOW_STARTED', 'WORKFLOW_COMPLETED', 'IMPORT_COMPLETED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('DRAFT', 'QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'REPLIED', 'BOUNCED', 'FAILED', 'CANCELED');

-- CreateTable
CREATE TABLE "crm_objects" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "singularName" TEXT NOT NULL,
    "pluralName" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "primaryAttributeId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "crm_objects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_attributes" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "AttributeType" NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isUnique" BOOLEAN NOT NULL DEFAULT false,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "crm_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_attribute_options" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_attribute_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_records" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "displayName" TEXT,
    "searchText" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "crm_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_values" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "textValue" TEXT,
    "longTextValue" TEXT,
    "numberValue" DECIMAL(18,6),
    "booleanValue" BOOLEAN,
    "dateValue" TIMESTAMP(3),
    "jsonValue" JSONB,
    "userValueId" TEXT,
    "currencyAmount" DECIMAL(18,2),
    "currencyCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_relationship_definitions" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sourceObjectId" TEXT NOT NULL,
    "sourceAttributeId" TEXT NOT NULL,
    "targetObjectId" TEXT NOT NULL,
    "reverseAttributeId" TEXT,
    "cardinality" "RelationshipCardinality" NOT NULL DEFAULT 'MANY_TO_MANY',
    "isBidirectional" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "crm_relationship_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_relationship_values" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "sourceAttributeId" TEXT NOT NULL,
    "targetRecordId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_relationship_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_views" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "objectId" TEXT,
    "listId" TEXT,
    "name" TEXT NOT NULL,
    "type" "ViewType" NOT NULL DEFAULT 'TABLE',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "groupByAttributeId" TEXT,
    "config" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "crm_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_view_columns" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "viewId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_view_columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_view_filters" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "viewId" TEXT NOT NULL,
    "attributeId" TEXT,
    "field" "SystemField",
    "operator" "FilterOperator" NOT NULL,
    "value" JSONB,
    "group" INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_view_filters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_view_sorts" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "viewId" TEXT NOT NULL,
    "attributeId" TEXT,
    "field" "SystemField",
    "direction" "SortDirection" NOT NULL DEFAULT 'ASC',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_view_sorts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_lists" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "primaryObjectId" TEXT NOT NULL,
    "type" "ListType" NOT NULL DEFAULT 'STATIC',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "crm_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_list_entries" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "stage" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "crm_list_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_activities" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "recordId" TEXT,
    "actorId" TEXT,
    "type" "ActivityType" NOT NULL,
    "title" TEXT,
    "body" TEXT,
    "payload" JSONB,
    "emailId" TEXT,
    "noteId" TEXT,
    "taskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_emails" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "recordId" TEXT,
    "senderUserId" TEXT,
    "direction" "Direction" NOT NULL,
    "channel" "Channel" NOT NULL DEFAULT 'EMAIL',
    "status" "EmailStatus" NOT NULL DEFAULT 'DRAFT',
    "fromEmail" TEXT,
    "fromName" TEXT,
    "toEmails" JSONB NOT NULL,
    "ccEmails" JSONB,
    "bccEmails" JSONB,
    "subject" TEXT,
    "bodyText" TEXT,
    "bodyHtml" TEXT,
    "provider" TEXT,
    "providerMessageId" TEXT,
    "threadId" TEXT,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "replyClass" "ReplyClass",
    "sentAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),
    "bouncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "crm_emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_notes" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "recordId" TEXT,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "crm_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_tasks" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "recordId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
    "dueAt" TIMESTAMP(3),
    "assigneeId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "crm_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_objects_orgId_idx" ON "crm_objects"("orgId");

-- CreateIndex
CREATE INDEX "crm_objects_primaryAttributeId_idx" ON "crm_objects"("primaryAttributeId");

-- CreateIndex
CREATE INDEX "crm_objects_createdById_idx" ON "crm_objects"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "crm_objects_orgId_key_key" ON "crm_objects"("orgId", "key");

-- CreateIndex
CREATE INDEX "crm_attributes_orgId_idx" ON "crm_attributes"("orgId");

-- CreateIndex
CREATE INDEX "crm_attributes_objectId_idx" ON "crm_attributes"("objectId");

-- CreateIndex
CREATE INDEX "crm_attributes_type_idx" ON "crm_attributes"("type");

-- CreateIndex
CREATE UNIQUE INDEX "crm_attributes_objectId_key_key" ON "crm_attributes"("objectId", "key");

-- CreateIndex
CREATE INDEX "crm_attribute_options_orgId_idx" ON "crm_attribute_options"("orgId");

-- CreateIndex
CREATE INDEX "crm_attribute_options_attributeId_idx" ON "crm_attribute_options"("attributeId");

-- CreateIndex
CREATE UNIQUE INDEX "crm_attribute_options_attributeId_value_key" ON "crm_attribute_options"("attributeId", "value");

-- CreateIndex
CREATE INDEX "crm_records_orgId_idx" ON "crm_records"("orgId");

-- CreateIndex
CREATE INDEX "crm_records_orgId_objectId_idx" ON "crm_records"("orgId", "objectId");

-- CreateIndex
CREATE INDEX "crm_records_objectId_createdAt_idx" ON "crm_records"("objectId", "createdAt");

-- CreateIndex
CREATE INDEX "crm_records_orgId_displayName_idx" ON "crm_records"("orgId", "displayName");

-- CreateIndex
CREATE INDEX "crm_records_createdById_idx" ON "crm_records"("createdById");

-- CreateIndex
CREATE INDEX "crm_records_updatedById_idx" ON "crm_records"("updatedById");

-- CreateIndex
CREATE INDEX "crm_values_orgId_idx" ON "crm_values"("orgId");

-- CreateIndex
CREATE INDEX "crm_values_recordId_idx" ON "crm_values"("recordId");

-- CreateIndex
CREATE INDEX "crm_values_attributeId_idx" ON "crm_values"("attributeId");

-- CreateIndex
CREATE INDEX "crm_values_attributeId_textValue_idx" ON "crm_values"("attributeId", "textValue");

-- CreateIndex
CREATE INDEX "crm_values_attributeId_numberValue_idx" ON "crm_values"("attributeId", "numberValue");

-- CreateIndex
CREATE INDEX "crm_values_attributeId_dateValue_idx" ON "crm_values"("attributeId", "dateValue");

-- CreateIndex
CREATE INDEX "crm_values_userValueId_idx" ON "crm_values"("userValueId");

-- CreateIndex
CREATE UNIQUE INDEX "crm_values_recordId_attributeId_key" ON "crm_values"("recordId", "attributeId");

-- CreateIndex
CREATE INDEX "crm_relationship_definitions_orgId_idx" ON "crm_relationship_definitions"("orgId");

-- CreateIndex
CREATE INDEX "crm_relationship_definitions_sourceObjectId_idx" ON "crm_relationship_definitions"("sourceObjectId");

-- CreateIndex
CREATE INDEX "crm_relationship_definitions_targetObjectId_idx" ON "crm_relationship_definitions"("targetObjectId");

-- CreateIndex
CREATE INDEX "crm_relationship_definitions_reverseAttributeId_idx" ON "crm_relationship_definitions"("reverseAttributeId");

-- CreateIndex
CREATE UNIQUE INDEX "crm_relationship_definitions_sourceAttributeId_key" ON "crm_relationship_definitions"("sourceAttributeId");

-- CreateIndex
CREATE INDEX "crm_relationship_values_orgId_idx" ON "crm_relationship_values"("orgId");

-- CreateIndex
CREATE INDEX "crm_relationship_values_sourceRecordId_idx" ON "crm_relationship_values"("sourceRecordId");

-- CreateIndex
CREATE INDEX "crm_relationship_values_targetRecordId_idx" ON "crm_relationship_values"("targetRecordId");

-- CreateIndex
CREATE INDEX "crm_relationship_values_sourceAttributeId_idx" ON "crm_relationship_values"("sourceAttributeId");

-- CreateIndex
CREATE UNIQUE INDEX "crm_relationship_values_sourceRecordId_sourceAttributeId_ta_key" ON "crm_relationship_values"("sourceRecordId", "sourceAttributeId", "targetRecordId");

-- CreateIndex
CREATE INDEX "crm_views_orgId_idx" ON "crm_views"("orgId");

-- CreateIndex
CREATE INDEX "crm_views_objectId_idx" ON "crm_views"("objectId");

-- CreateIndex
CREATE INDEX "crm_views_listId_idx" ON "crm_views"("listId");

-- CreateIndex
CREATE INDEX "crm_views_groupByAttributeId_idx" ON "crm_views"("groupByAttributeId");

-- CreateIndex
CREATE INDEX "crm_views_createdById_idx" ON "crm_views"("createdById");

-- CreateIndex
CREATE INDEX "crm_view_columns_orgId_idx" ON "crm_view_columns"("orgId");

-- CreateIndex
CREATE INDEX "crm_view_columns_viewId_idx" ON "crm_view_columns"("viewId");

-- CreateIndex
CREATE INDEX "crm_view_columns_attributeId_idx" ON "crm_view_columns"("attributeId");

-- CreateIndex
CREATE UNIQUE INDEX "crm_view_columns_viewId_attributeId_key" ON "crm_view_columns"("viewId", "attributeId");

-- CreateIndex
CREATE INDEX "crm_view_filters_orgId_idx" ON "crm_view_filters"("orgId");

-- CreateIndex
CREATE INDEX "crm_view_filters_viewId_idx" ON "crm_view_filters"("viewId");

-- CreateIndex
CREATE INDEX "crm_view_filters_attributeId_idx" ON "crm_view_filters"("attributeId");

-- CreateIndex
CREATE INDEX "crm_view_sorts_orgId_idx" ON "crm_view_sorts"("orgId");

-- CreateIndex
CREATE INDEX "crm_view_sorts_viewId_idx" ON "crm_view_sorts"("viewId");

-- CreateIndex
CREATE INDEX "crm_view_sorts_attributeId_idx" ON "crm_view_sorts"("attributeId");

-- CreateIndex
CREATE INDEX "crm_lists_orgId_idx" ON "crm_lists"("orgId");

-- CreateIndex
CREATE INDEX "crm_lists_primaryObjectId_idx" ON "crm_lists"("primaryObjectId");

-- CreateIndex
CREATE INDEX "crm_lists_createdById_idx" ON "crm_lists"("createdById");

-- CreateIndex
CREATE INDEX "crm_list_entries_orgId_idx" ON "crm_list_entries"("orgId");

-- CreateIndex
CREATE INDEX "crm_list_entries_listId_idx" ON "crm_list_entries"("listId");

-- CreateIndex
CREATE INDEX "crm_list_entries_recordId_idx" ON "crm_list_entries"("recordId");

-- CreateIndex
CREATE INDEX "crm_list_entries_stage_idx" ON "crm_list_entries"("stage");

-- CreateIndex
CREATE INDEX "crm_list_entries_addedById_idx" ON "crm_list_entries"("addedById");

-- CreateIndex
CREATE UNIQUE INDEX "crm_list_entries_listId_recordId_key" ON "crm_list_entries"("listId", "recordId");

-- CreateIndex
CREATE INDEX "crm_activities_orgId_idx" ON "crm_activities"("orgId");

-- CreateIndex
CREATE INDEX "crm_activities_recordId_createdAt_idx" ON "crm_activities"("recordId", "createdAt");

-- CreateIndex
CREATE INDEX "crm_activities_actorId_idx" ON "crm_activities"("actorId");

-- CreateIndex
CREATE INDEX "crm_activities_type_idx" ON "crm_activities"("type");

-- CreateIndex
CREATE INDEX "crm_activities_emailId_idx" ON "crm_activities"("emailId");

-- CreateIndex
CREATE INDEX "crm_activities_noteId_idx" ON "crm_activities"("noteId");

-- CreateIndex
CREATE INDEX "crm_activities_taskId_idx" ON "crm_activities"("taskId");

-- CreateIndex
CREATE INDEX "crm_emails_orgId_idx" ON "crm_emails"("orgId");

-- CreateIndex
CREATE INDEX "crm_emails_recordId_idx" ON "crm_emails"("recordId");

-- CreateIndex
CREATE INDEX "crm_emails_senderUserId_idx" ON "crm_emails"("senderUserId");

-- CreateIndex
CREATE INDEX "crm_emails_status_idx" ON "crm_emails"("status");

-- CreateIndex
CREATE INDEX "crm_emails_sentAt_idx" ON "crm_emails"("sentAt");

-- CreateIndex
CREATE INDEX "crm_emails_providerMessageId_idx" ON "crm_emails"("providerMessageId");

-- CreateIndex
CREATE INDEX "crm_notes_orgId_idx" ON "crm_notes"("orgId");

-- CreateIndex
CREATE INDEX "crm_notes_recordId_idx" ON "crm_notes"("recordId");

-- CreateIndex
CREATE INDEX "crm_notes_authorId_idx" ON "crm_notes"("authorId");

-- CreateIndex
CREATE INDEX "crm_tasks_orgId_idx" ON "crm_tasks"("orgId");

-- CreateIndex
CREATE INDEX "crm_tasks_recordId_idx" ON "crm_tasks"("recordId");

-- CreateIndex
CREATE INDEX "crm_tasks_assigneeId_idx" ON "crm_tasks"("assigneeId");

-- CreateIndex
CREATE INDEX "crm_tasks_createdById_idx" ON "crm_tasks"("createdById");

-- CreateIndex
CREATE INDEX "crm_tasks_status_idx" ON "crm_tasks"("status");

-- CreateIndex
CREATE INDEX "crm_tasks_dueAt_idx" ON "crm_tasks"("dueAt");

-- AddForeignKey
ALTER TABLE "crm_objects" ADD CONSTRAINT "crm_objects_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_objects" ADD CONSTRAINT "crm_objects_primaryAttributeId_fkey" FOREIGN KEY ("primaryAttributeId") REFERENCES "crm_attributes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_objects" ADD CONSTRAINT "crm_objects_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_attributes" ADD CONSTRAINT "crm_attributes_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_attributes" ADD CONSTRAINT "crm_attributes_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "crm_objects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_attribute_options" ADD CONSTRAINT "crm_attribute_options_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_attribute_options" ADD CONSTRAINT "crm_attribute_options_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "crm_attributes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_records" ADD CONSTRAINT "crm_records_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_records" ADD CONSTRAINT "crm_records_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "crm_objects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_records" ADD CONSTRAINT "crm_records_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_records" ADD CONSTRAINT "crm_records_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_values" ADD CONSTRAINT "crm_values_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_values" ADD CONSTRAINT "crm_values_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "crm_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_values" ADD CONSTRAINT "crm_values_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "crm_attributes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_values" ADD CONSTRAINT "crm_values_userValueId_fkey" FOREIGN KEY ("userValueId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_relationship_definitions" ADD CONSTRAINT "crm_relationship_definitions_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_relationship_definitions" ADD CONSTRAINT "crm_relationship_definitions_sourceObjectId_fkey" FOREIGN KEY ("sourceObjectId") REFERENCES "crm_objects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_relationship_definitions" ADD CONSTRAINT "crm_relationship_definitions_sourceAttributeId_fkey" FOREIGN KEY ("sourceAttributeId") REFERENCES "crm_attributes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_relationship_definitions" ADD CONSTRAINT "crm_relationship_definitions_targetObjectId_fkey" FOREIGN KEY ("targetObjectId") REFERENCES "crm_objects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_relationship_definitions" ADD CONSTRAINT "crm_relationship_definitions_reverseAttributeId_fkey" FOREIGN KEY ("reverseAttributeId") REFERENCES "crm_attributes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_relationship_values" ADD CONSTRAINT "crm_relationship_values_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_relationship_values" ADD CONSTRAINT "crm_relationship_values_sourceRecordId_fkey" FOREIGN KEY ("sourceRecordId") REFERENCES "crm_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_relationship_values" ADD CONSTRAINT "crm_relationship_values_sourceAttributeId_fkey" FOREIGN KEY ("sourceAttributeId") REFERENCES "crm_attributes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_relationship_values" ADD CONSTRAINT "crm_relationship_values_targetRecordId_fkey" FOREIGN KEY ("targetRecordId") REFERENCES "crm_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_views" ADD CONSTRAINT "crm_views_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_views" ADD CONSTRAINT "crm_views_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "crm_objects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_views" ADD CONSTRAINT "crm_views_listId_fkey" FOREIGN KEY ("listId") REFERENCES "crm_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_views" ADD CONSTRAINT "crm_views_groupByAttributeId_fkey" FOREIGN KEY ("groupByAttributeId") REFERENCES "crm_attributes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_views" ADD CONSTRAINT "crm_views_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_view_columns" ADD CONSTRAINT "crm_view_columns_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_view_columns" ADD CONSTRAINT "crm_view_columns_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "crm_views"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_view_columns" ADD CONSTRAINT "crm_view_columns_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "crm_attributes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_view_filters" ADD CONSTRAINT "crm_view_filters_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_view_filters" ADD CONSTRAINT "crm_view_filters_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "crm_views"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_view_filters" ADD CONSTRAINT "crm_view_filters_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "crm_attributes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_view_sorts" ADD CONSTRAINT "crm_view_sorts_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_view_sorts" ADD CONSTRAINT "crm_view_sorts_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "crm_views"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_view_sorts" ADD CONSTRAINT "crm_view_sorts_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "crm_attributes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lists" ADD CONSTRAINT "crm_lists_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lists" ADD CONSTRAINT "crm_lists_primaryObjectId_fkey" FOREIGN KEY ("primaryObjectId") REFERENCES "crm_objects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lists" ADD CONSTRAINT "crm_lists_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_list_entries" ADD CONSTRAINT "crm_list_entries_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_list_entries" ADD CONSTRAINT "crm_list_entries_listId_fkey" FOREIGN KEY ("listId") REFERENCES "crm_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_list_entries" ADD CONSTRAINT "crm_list_entries_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "crm_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_list_entries" ADD CONSTRAINT "crm_list_entries_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "crm_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "crm_emails"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "crm_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "crm_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_emails" ADD CONSTRAINT "crm_emails_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_emails" ADD CONSTRAINT "crm_emails_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "crm_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_emails" ADD CONSTRAINT "crm_emails_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_notes" ADD CONSTRAINT "crm_notes_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_notes" ADD CONSTRAINT "crm_notes_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "crm_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_notes" ADD CONSTRAINT "crm_notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "crm_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
