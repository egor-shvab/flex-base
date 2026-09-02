-- Per-table display number for records. Written by hand rather than generated: the column is
-- required and the table already holds rows, so it has to be backfilled between being added
-- and being made NOT NULL.

-- AlterTable
ALTER TABLE "Record" ADD COLUMN "number" INTEGER;

-- Number the existing rows in creation order, per table, so the numbers match the order
-- users already see (the list defaults to newest first, which is this order reversed).
UPDATE "Record" AS r
SET "number" = s.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "tableId" ORDER BY "createdAt", id) AS rn
  FROM "Record"
) AS s
WHERE r.id = s.id;

ALTER TABLE "Record" ALTER COLUMN "number" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Record_tableId_number_key" ON "Record"("tableId", "number");

-- AlterTable
ALTER TABLE "Table" ADD COLUMN "recordCounter" INTEGER NOT NULL DEFAULT 0;

-- Seed each counter past the numbers just assigned, so the next insert continues the run
-- rather than colliding with an existing row.
UPDATE "Table" AS t
SET "recordCounter" = COALESCE(
  (SELECT MAX("number") FROM "Record" WHERE "tableId" = t.id),
  0
);
