-- The default list order is ("createdAt", "number") within a table, so its index carries the
-- tie-break too and a page is read straight off it in either direction. CONCURRENTLY, because
-- "Record" grows with user data and a plain build would block every write for its duration; that
-- is also why this file holds one statement and the old index goes in the next migration.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Record_tableId_createdAt_number_idx" ON "Record"("tableId", "createdAt", "number");
