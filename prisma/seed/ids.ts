import { createHash } from 'node:crypto'

/**
 * Computed rather than `@default(cuid())`, so the writer is a single pass: forward references need
 * ids before the first insert, and an update would overwrite the seeded `updatedAt`.
 */
export function idFor(ref: string): string {
  return `c${createHash('sha256').update(ref).digest('hex').slice(0, 24)}`
}
