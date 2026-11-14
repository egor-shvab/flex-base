-- Records per table, kept by the writes that create and delete them, so the sidebar reads a column
-- instead of counting rows. Written by hand: the column is required and the table already holds
-- rows, so it is backfilled between being added and being made NOT NULL.

-- AlterTable
ALTER TABLE "Table" ADD COLUMN "recordCount" INTEGER;

-- Once per table, each served by the ("tableId", …) indexes on "Record".
UPDATE "Table" AS t
SET "recordCount" = (SELECT COUNT(*) FROM "Record" AS r WHERE r."tableId" = t.id);

-- Plain SET NOT NULL: it scans "Table", one row per user table, never the records.
ALTER TABLE "Table" ALTER COLUMN "recordCount" SET DEFAULT 0;
ALTER TABLE "Table" ALTER COLUMN "recordCount" SET NOT NULL;
