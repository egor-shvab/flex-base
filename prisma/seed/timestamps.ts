import { createHash } from 'node:crypto'

const WINDOW_START = Date.UTC(2025, 8, 1)
const WINDOW_END = Date.UTC(2026, 7, 28)
const WINDOW_MS = WINDOW_END - WINDOW_START

const DAY_MS = 24 * 60 * 60 * 1000

export interface ISeedTimestamps {
  createdAt: Date
  updatedAt: Date
}

function fractionsFor(ref: string): [number, number] {
  const digest = createHash('sha256').update(`ts:${ref}`).digest()

  return [digest.readUInt32BE(0) / 4294967296, digest.readUInt32BE(4) / 4294967296]
}

export function timestampsFor(ref: string): ISeedTimestamps {
  const [placement, edit] = fractionsFor(ref)

  const created = WINDOW_START + Math.floor(placement * WINDOW_MS)

  const room = Math.min(60 * DAY_MS, WINDOW_END - created)
  const updated = created + Math.floor(edit * room)

  return { createdAt: new Date(created), updatedAt: new Date(updated) }
}
