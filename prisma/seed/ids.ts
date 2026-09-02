import { createHash } from 'node:crypto'

/**
 * The id a seeded row takes, derived from the local ref the dataset gives it.
 *
 * **Computed rather than left to `@default(cuid())`, which is what makes the writer a single
 * pass.** A relation stores the target's id and the dataset has forward references, so ids have
 * to exist before the first insert. Inserting then updating is not available: `Record.updatedAt`
 * is `@updatedAt`, so any update overwrites the timestamp the seed set on purpose.
 *
 * Shaped like a cuid, because these ids reach the same places a real one does —
 * `parseAddressNumber` must read them as "not a record number". Nothing validates the format
 * further, so a hash prefix is enough and a re-run reproduces the same ids.
 */
export function idFor(ref: string): string {
  return `c${createHash('sha256').update(ref).digest('hex').slice(0, 24)}`
}
