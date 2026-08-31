-- Free-text search, served from an index instead of scanning every row.
--
-- Written by hand: none of the three objects below can be expressed in `schema.prisma`.
-- Prisma ignores all of them — `migrate diff` against a database holding them reports an
-- empty migration — so they are created here and never managed by the schema.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- One row flattened to the text a search matches against.
--
-- Deliberately **over-inclusive**: it is a pre-filter, not the comparison. `buildRecordSearch`
-- still applies the exact per-type predicates after it, so a value this returns that no field
-- type considers searchable (a RELATION's cuid, a boolean) costs a row the exact predicate then
-- rejects. What it may never do is *miss* a value some type does search — that would be a
-- silent false negative, which is why the superset property has its own test.
--
-- `IMMUTABLE` because an index expression must be; `SET search_path` because without it the
-- indexed value would depend on the session's own search_path, which is both a correctness bug
-- and a privilege-escalation shape. Every function it calls is resolved from `pg_catalog`.
CREATE OR REPLACE FUNCTION record_search_text(data jsonb, num integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT '#' || num || ' ' || COALESCE(string_agg(value, ' '), '')
  FROM (
    -- `#>> '{}'` unwraps a scalar to its text without the quotes `->>` would leave on a
    -- string; an array contributes its elements, never the brackets and commas holding them
    -- together, so a term of `["` or `", "` cannot match punctuation that is not user text.
    SELECT CASE
             WHEN jsonb_typeof(entry.value) = 'array'
               THEN (SELECT string_agg(element, ' ')
                     FROM jsonb_array_elements_text(entry.value) AS element)
             ELSE entry.value #>> '{}'
           END AS value
    FROM jsonb_each(data) AS entry
    WHERE jsonb_typeof(entry.value) <> 'null'
  ) AS flattened
$$;

-- One index for every table, not one per table: the expression reads only the row, so nothing
-- about it is per-table and no lifecycle is needed. A query must repeat this expression exactly
-- or the planner will not match it, which is why `buildRecordSearch` is its only caller.
CREATE INDEX "Record_search_trgm_idx"
  ON "Record" USING gin ((record_search_text(data, "number")) gin_trgm_ops);
