-- Data-only migration: SELECT choices gain a colour.
--
-- `Field.options` is an untyped `Json?` column, so the shape change produces no schema
-- drift and `prisma migrate dev` generates nothing. Written by hand behind `--create-only`,
-- the way CLAUDE.md §5 requires for a change that rewrites user data.
--
-- Rewrites the legacy `{"choices": ["A", "B"]}` into `{"choices": [{"value": "A", "color": "gray"},
-- ...]}`. Non-destructive: no column is dropped or retyped, and every existing choice keeps
-- its text and its position. Idempotent: the `->0 = 'string'` guard skips rows already in the
-- new shape, so a re-run is a no-op. A SELECT with no choices is skipped too — its `[]` is
-- already valid, and `->0` is NULL there.
UPDATE "Field"
SET "options" = jsonb_set(
      "options",
      '{choices}',
      COALESCE(
        (
          SELECT jsonb_agg(
                   jsonb_build_object('value', choice.value, 'color', 'gray')
                   ORDER BY choice.ord
                 )
          FROM jsonb_array_elements_text("options" -> 'choices')
               WITH ORDINALITY AS choice(value, ord)
        ),
        '[]'::jsonb
      )
    )
WHERE "type" = 'SELECT'
  AND jsonb_typeof("options" -> 'choices') = 'array'
  AND jsonb_typeof("options" -> 'choices' -> 0) = 'string';
