import { createHash } from 'node:crypto'

/**
 * When a seeded record was created and last touched.
 *
 * The record's own `createdAt` and `updatedAt` columns sort and range-filter like any field, so
 * a demo where every row shares one timestamp leaves two of the three record columns untestable.
 * They are spread across the window below instead — derived from the row's ref, so the spread is
 * the same on every run and no row's position depends on when the seed was executed.
 *
 * Settable **only on create**: `updatedAt` is `@updatedAt`, which Prisma overwrites on any
 * update. That is the constraint the whole single-pass writer is built around (`ids.ts`).
 */

const WINDOW_START = Date.UTC(2025, 8, 1)
const WINDOW_END = Date.UTC(2026, 7, 28)
const WINDOW_MS = WINDOW_END - WINDOW_START

const DAY_MS = 24 * 60 * 60 * 1000

export interface ISeedTimestamps {
  createdAt: Date
  updatedAt: Date
}

/** Two 32-bit fractions from one hash, so creation and the edit after it are independent. */
function fractionsFor(ref: string): [number, number] {
  const digest = createHash('sha256').update(`ts:${ref}`).digest()

  return [digest.readUInt32BE(0) / 4294967296, digest.readUInt32BE(4) / 4294967296]
}

export function timestampsFor(ref: string): ISeedTimestamps {
  const [placement, edit] = fractionsFor(ref)

  const created = WINDOW_START + Math.floor(placement * WINDOW_MS)

  // Edited up to sixty days later, or up to whatever is left of the window if that is sooner —
  // so `updatedAt` is always at or after `createdAt` and never past the end. **Scaled rather than
  // clamped:** clamping piles every row created in the last sixty days onto the same instant, and
  // a column where a fifth of the table shares one value sorts into an arbitrary block.
  const room = Math.min(60 * DAY_MS, WINDOW_END - created)
  const updated = created + Math.floor(edit * room)

  return { createdAt: new Date(created), updatedAt: new Date(updated) }
}
