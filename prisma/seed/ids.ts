import { createHash } from 'node:crypto'

/**
 * The id a seeded row takes, derived from the local ref the dataset gives it.
 *
 * **Computed rather than left to `@default(cuid())`, and that is what makes the writer a single
 * pass.** A relation stores the target's id, and the dataset has forward references — Projects
 * link to People declared later in the same run, and a Task can be blocked by another Task — so
 * ids have to exist before the first insert. The alternative is inserting and then updating,
 * which is not available here: `Record.updatedAt` is `@updatedAt`, so any update would overwrite
 * the timestamp the seed set on purpose.
 *
 * Shaped like a cuid — leading letter, then lowercase alphanumerics — because these ids reach the
 * same places a real one does: `parseAddressNumber` must read them as "not a record number", and
 * a relation's `options.targetTableId` is compared as an opaque string. Nothing validates the
 * format beyond that, so a hash prefix is enough, and it makes a re-run reproduce the same ids.
 */
export function idFor(ref: string): string {
  return `c${createHash('sha256').update(ref).digest('hex').slice(0, 24)}`
}
