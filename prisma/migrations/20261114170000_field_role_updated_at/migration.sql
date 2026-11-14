-- The version a field or role edit form sends back as `If-Match`, so a save made on a stale copy is
-- refused instead of overwriting the newer one. A non-volatile default makes each a catalogue
-- change, not a rewrite: existing rows read the migration's own timestamp.

-- AlterTable
ALTER TABLE "Field" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "WorkspaceRole" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
