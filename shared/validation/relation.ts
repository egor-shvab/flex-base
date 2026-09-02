import { z } from 'zod'

/** Bounds the pattern a caller can push into an `ILIKE`, not what a user would ever type. */
const RELATION_SEARCH_MAX_LENGTH = 100

/**
 * The relation picker's own query. One optional term, absent meaning "the default list".
 *
 * **No `SEARCH_MIN_LENGTH` here, deliberately.** That floor exists because the records search is
 * an unanchored `ILIKE` ORed across every searchable column and paid twice for the count. None
 * of it applies here: one expression over one table, a hard `LIMIT`, no count, and a debounce in
 * front. A one-character term costs what the zero-character term already costs.
 */
export const relationOptionsQuerySchema = z.object({
  // A repeated `?q=` arrives as an array and fails this, which is the 400 we want
  q: z.string().trim().max(RELATION_SEARCH_MAX_LENGTH).optional().default(''),
})
