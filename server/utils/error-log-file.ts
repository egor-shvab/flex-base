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
import { formatErrorLogLine, type IErrorLogEntry } from '#server/utils/error-log'

const LOG_PATH = resolve(process.cwd(), 'logs', 'server-errors.log')
export const MAX_LOG_BYTES = 5 * 1024 * 1024
const LOG_GENERATIONS = 5

interface IErrorLogRotation {
  remove: string
  renames: { from: string; to: string }[]
}

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
  // The descriptor closes **before** the first rename: Windows refuses to rename an open file
  closeLog()

  const plan = planErrorLogRotation(LOG_PATH, LOG_GENERATIONS)
  rmSync(plan.remove, { force: true })
  for (const { from, to } of plan.renames) {
    if (existsSync(from)) renameSync(from, to)
  }
}

/**
 * Never throws, or a logged fault becomes a louder one on the response path. Synchronous on
 * purpose: a buffered stream loses its tail — the entry before a crash — when the process dies.
 */
export function appendErrorLogLine(line: string): void {
  if (disabled) return

  try {
    const bytes = Buffer.byteLength(line)

    openLog()
    if (writtenBytes > 0 && writtenBytes + bytes > MAX_LOG_BYTES) {
      rotateLog()
      openLog()
    }

    if (handle === null) return
    writeSync(handle, line)
    writtenBytes += bytes
  } catch {
    disabled = true
    closeLog()
  }
}

export function recordErrorEntry(entry: IErrorLogEntry): void {
  appendErrorLogLine(formatErrorLogLine(entry))
}
