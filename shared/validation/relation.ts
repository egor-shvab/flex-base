import { z } from 'zod'

/** Bounds the pattern a caller can push into an `ILIKE`, not what a user would ever type. */
const RELATION_SEARCH_MAX_LENGTH = 100

/**
 * The relation picker's own query. One optional term, absent meaning "the default list".
 *
 * **No `SEARCH_MIN_LENGTH` here, deliberately.** That floor exists because the records
 * search is an unanchored `ILIKE` ORed across every searchable column, paid twice because
 * the count query cannot stop early — so one character scans the whole table for nothing.
 * None of it applies to this query: one expression over one table chosen by the field's own
 * metadata, a hard `LIMIT`, no count, and a debounce in front of it. A one-character term
 * costs exactly what the *zero*-character term this endpoint already serves costs, so
 * rejecting `a` while accepting `` would be the name of a constant, not a reason.
 */
export const relationOptionsQuerySchema = z.object({
  // A repeated `?q=` arrives as an array and fails this, which is the 400 we want
  q: z.string().trim().max(RELATION_SEARCH_MAX_LENGTH).optional().default(''),
})
