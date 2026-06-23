-- M30-1: list-specific атрибуты (process lists) — ListAttribute + ListEntryValue.

-- CreateTable
CREATE TABLE "crm_list_attributes" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "AttributeType" NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "crm_list_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_list_entry_values" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "listEntryId" TEXT NOT NULL,
    "listAttributeId" TEXT NOT NULL,
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

    CONSTRAINT "crm_list_entry_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_list_attributes_orgId_idx" ON "crm_list_attributes"("orgId");
CREATE INDEX "crm_list_attributes_listId_idx" ON "crm_list_attributes"("listId");
CREATE UNIQUE INDEX "crm_list_attributes_listId_key_key" ON "crm_list_attributes"("listId", "key");
CREATE INDEX "crm_list_entry_values_orgId_idx" ON "crm_list_entry_values"("orgId");
CREATE INDEX "crm_list_entry_values_listEntryId_idx" ON "crm_list_entry_values"("listEntryId");
CREATE INDEX "crm_list_entry_values_listAttributeId_idx" ON "crm_list_entry_values"("listAttributeId");
CREATE UNIQUE INDEX "crm_list_entry_values_listEntryId_listAttributeId_key" ON "crm_list_entry_values"("listEntryId", "listAttributeId");

-- AddForeignKey
ALTER TABLE "crm_list_attributes" ADD CONSTRAINT "crm_list_attributes_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_list_attributes" ADD CONSTRAINT "crm_list_attributes_listId_fkey" FOREIGN KEY ("listId") REFERENCES "crm_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_list_attributes" ADD CONSTRAINT "crm_list_attributes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_list_entry_values" ADD CONSTRAINT "crm_list_entry_values_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_list_entry_values" ADD CONSTRAINT "crm_list_entry_values_listEntryId_fkey" FOREIGN KEY ("listEntryId") REFERENCES "crm_list_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_list_entry_values" ADD CONSTRAINT "crm_list_entry_values_listAttributeId_fkey" FOREIGN KEY ("listAttributeId") REFERENCES "crm_list_attributes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_list_entry_values" ADD CONSTRAINT "crm_list_entry_values_userValueId_fkey" FOREIGN KEY ("userValueId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
