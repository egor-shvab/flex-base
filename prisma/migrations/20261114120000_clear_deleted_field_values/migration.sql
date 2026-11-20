-- Values a field deleted before `deleteField` cleared them left under its key. The key is free
-- again, so a new field of any type could take it and inherit them. Only rows holding such a key
-- are rewritten; "Field"'s (tableId, key) unique index serves each lookup.
UPDATE "Record" r
SET data = r.data - ARRAY(
  SELECT k FROM jsonb_object_keys(r.data) AS k
  WHERE NOT EXISTS (SELECT 1 FROM "Field" f WHERE f."tableId" = r."tableId" AND f.key = k)
)
WHERE EXISTS (
  SELECT 1 FROM jsonb_object_keys(r.data) AS k
  WHERE NOT EXISTS (SELECT 1 FROM "Field" f WHERE f."tableId" = r."tableId" AND f.key = k)
);
