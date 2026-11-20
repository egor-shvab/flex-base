-- For a role limited to its own records. CONCURRENTLY and alone in its file, for the reason
-- 20261114160000_record_order_index gives.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Record_tableId_createdById_idx" ON "Record"("tableId", "createdById");
