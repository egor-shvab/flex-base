-- Who created a record and who last changed it. Nullable: an author can be unknown.

-- AlterTable
ALTER TABLE "Record" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "updatedById" TEXT;

-- Until workspaces, a table's owner is the only person who could have written its records. This
-- rewrites every record row once: acceptable before there is production data, not after.
UPDATE "Record" AS r
SET "createdById" = t."userId", "updatedById" = t."userId"
FROM "Table" AS t
WHERE t."id" = r."tableId";

-- AddForeignKey
ALTER TABLE "Record" ADD CONSTRAINT "Record_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Record" ADD CONSTRAINT "Record_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
