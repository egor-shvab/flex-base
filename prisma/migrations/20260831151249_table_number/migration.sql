-- Per-user display number for tables, and the counter that allocates it. Written by hand rather
-- than generated: the column is required and the table already holds rows, so it has to be
-- backfilled between being added and being made NOT NULL.

-- AlterTable
ALTER TABLE "Table" ADD COLUMN "number" INTEGER;

-- Number the existing rows in creation order, per user, so the numbers match the order the
-- sidebar already draws them in (listTables orders by createdAt ascending).
UPDATE "Table" AS t
SET "number" = s.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "createdAt", id) AS rn
  FROM "Table"
) AS s
WHERE t.id = s.id;

-- Plain SET NOT NULL: it takes an ACCESS EXCLUSIVE lock and scans, which is nothing against a
-- table holding one user's tables. The NOT VALID CHECK -> VALIDATE -> SET NOT NULL dance that
-- avoids the scan is for columns over rows that grow with user data, which this is not.
ALTER TABLE "Table" ALTER COLUMN "number" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Table_userId_number_key" ON "Table"("userId", "number");

-- AlterTable
ALTER TABLE "User" ADD COLUMN "tableCounter" INTEGER NOT NULL DEFAULT 0;

-- Seed each counter past the numbers just assigned, so the next insert continues the run rather
-- than colliding with an existing row. MAX rather than COUNT: the counter is a high-water mark,
-- and only MAX stays right over a set with gaps in it.
UPDATE "User" AS u
SET "tableCounter" = COALESCE(
  (SELECT MAX("number") FROM "Table" WHERE "userId" = u.id),
  0
);
