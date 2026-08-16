import { Buffer } from 'node:buffer'
import {
  closeSync,
  existsSync,
  fstatSync,
  mkdirSync,
  openSync,
  renameSync,
  rmSync,
  writeSync,
} from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
import process from 'node:process'

/** Already covered by `.gitignore` (`logs`, `*.log`), so nothing here needs committing. */
const LOG_PATH = resolve(process.cwd(), 'logs', 'server-errors.log')
/** Exported so the spec drives rotation from the real threshold rather than a guess at it. */
export const MAX_LOG_BYTES = 5 * 1024 * 1024
const LOG_GENERATIONS = 5

interface IErrorLogRotation {
  /** The oldest generation, dropped rather than renamed — nothing is left to hold it. */
  remove: string
  /** Applied in order. Highest generation first, so no rename overwrites a live file. */
  renames: { from: string; to: string }[]
}

/**
 * Pure, so the ordering can be asserted without a disk: `.4` must move to `.5` before `.3`
 * moves to `.4`, and the live file moves last. Reversing the walk overwrites every
 * generation with the newest one.
 */
export function planErrorLogRotation(basePath: string, generations: number): IErrorLogRotation {
  const extension = extname(basePath)
  const stem = extension ? basePath.slice(0, -extension.length) : basePath
  const generationPath = (index: number) => `${stem}.${index}${extension}`

  const renames: { from: string; to: string }[] = []
  for (let index = generations - 1; index >= 1; index -= 1) {
    renames.push({ from: generationPath(index), to: generationPath(index + 1) })
  }
  renames.push({ from: basePath, to: generationPath(1) })

  return { remove: generationPath(generations), renames }
}

let handle: number | null = null
let writtenBytes = 0
let disabled = false

function closeLog(): void {
  if (handle === null) return
  try {
    closeSync(handle)
  } catch {
    // The descriptor is already gone; the state below is what the next call reads
  }
  handle = null
  writtenBytes = 0
}

function openLog(): void {
  if (handle !== null) return
  mkdirSync(dirname(LOG_PATH), { recursive: true })
  handle = openSync(LOG_PATH, 'a')
  writtenBytes = fstatSync(handle).size
}

function rotateLog(): void {
  // The descriptor closes **before** the first rename: Windows refuses to rename a file
  // that is still open, and this is a Windows development machine.
  closeLog()

  const plan = planErrorLogRotation(LOG_PATH, LOG_GENERATIONS)
  rmSync(plan.remove, { force: true })
  for (const { from, to } of plan.renames) {
    if (existsSync(from)) renameSync(from, to)
  }
}

/**
 * Appends one NDJSON line, and **never throws** — a sink that failed loudly would turn a
 * logged fault into a second, louder one on the response path.
 *
 * The write is synchronous on purpose. A buffered stream loses its tail when the process
 * dies, and the entry worth having is the last one before a crash; the hook only fires on
 * a 5xx, so this is a rare, small `write(2)` rather than anything on a hot path.
 */
export function appendErrorLogLine(line: string): void {
  if (disabled) return

  try {
    const bytes = Buffer.byteLength(line)

    openLog()
    // A line larger than the cap on its own still gets written — it rotates the file behind
    // it rather than being dropped
    if (writtenBytes > 0 && writtenBytes + bytes > MAX_LOG_BYTES) {
      rotateLog()
      openLog()
    }

    if (handle === null) return
    writeSync(handle, line)
    writtenBytes += bytes
  } catch {
    // There is nowhere left to report this to, so logging stops for the process lifetime
    // rather than retrying into the same failure on every subsequent error.
    disabled = true
    closeLog()
  }
}
