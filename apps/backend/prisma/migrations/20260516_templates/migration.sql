CREATE TABLE "Template" (
  "id"        TEXT NOT NULL,
  "orgId"     TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "subject"   TEXT,
  "body"      TEXT NOT NULL,
  "channel"   "Channel" NOT NULL DEFAULT 'EMAIL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Template_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Template_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
