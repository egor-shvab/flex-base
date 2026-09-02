import { beforeEach, describe, expect, it, vi } from 'vitest'
import { planErrorLogRotation } from '#server/utils/error-log-file'

const FD = 7

// The sink's only contact with the outside world. Driven through a hoisted state object
// rather than `mockImplementation`, so the spec never has to satisfy the overload
// signatures `node:fs` declares.
const fsState = vi.hoisted(() => ({ fileSize: 0, filesExist: true, failOnWrite: false }))

vi.mock('node:fs', () => ({
  closeSync: vi.fn(),
  existsSync: vi.fn(() => fsState.filesExist),
  fstatSync: vi.fn(() => ({ size: fsState.fileSize })),
  mkdirSync: vi.fn(),
  openSync: vi.fn(() => FD),
  // The last rename moves the live file aside, so what reopens behind it is empty
  renameSync: vi.fn(() => {
    fsState.fileSize = 0
  }),
  rmSync: vi.fn(),
  writeSync: vi.fn(() => {
    if (fsState.failOnWrite) throw new Error('EACCES: permission denied')
    return 0
  }),
}))

/**
 * The sink keeps a descriptor and a byte count for the lifetime of the module, so each case
 * gets its own copy of the module rather than inheriting the previous case's open file.
 */
async function loadSink() {
  vi.resetModules()
  const fs = vi.mocked(await import('node:fs'))
  const sink = await import('#server/utils/error-log-file')
  return { fs, sink }
}

beforeEach(() => {
  // `resetModules` gives the sink fresh state but leaves the mock registry alone, so the
  // `vi.fn()`s above are the same instances every case and would otherwise accumulate calls
  vi.clearAllMocks()
  fsState.fileSize = 0
  fsState.filesExist = true
  fsState.failOnWrite = false
})

describe('planErrorLogRotation', () => {
  it('numbers a generation before the extension, so every file stays a .log', () => {
    const plan = planErrorLogRotation('/srv/logs/server-errors.log', 3)

    expect(plan.remove).toBe('/srv/logs/server-errors.3.log')
    expect(plan.renames.map(({ to }) => to)).toEqual([
      '/srv/logs/server-errors.3.log',
      '/srv/logs/server-errors.2.log',
      '/srv/logs/server-errors.1.log',
    ])
  })

  // Walking the other way would rename .1 onto .2, then that same file onto .3, and finish
  // with five copies of the newest generation
  it('walks the generations highest first, and moves the live file last', () => {
    const plan = planErrorLogRotation('/srv/logs/server-errors.log', 4)

    expect(plan.renames).toEqual([
      { from: '/srv/logs/server-errors.3.log', to: '/srv/logs/server-errors.4.log' },
      { from: '/srv/logs/server-errors.2.log', to: '/srv/logs/server-errors.3.log' },
      { from: '/srv/logs/server-errors.1.log', to: '/srv/logs/server-errors.2.log' },
      { from: '/srv/logs/server-errors.log', to: '/srv/logs/server-errors.1.log' },
    ])
  })

  it('drops the oldest generation rather than renaming it — nothing is left to hold it', () => {
    const plan = planErrorLogRotation('/srv/logs/server-errors.log', 5)

    expect(plan.remove).toBe('/srv/logs/server-errors.5.log')
    expect(plan.renames.map(({ from }) => from)).not.toContain(plan.remove)
  })

  it('keeping one generation moves the live file and drops what was there', () => {
    const plan = planErrorLogRotation('/srv/logs/server-errors.log', 1)

    expect(plan.remove).toBe('/srv/logs/server-errors.1.log')
    expect(plan.renames).toEqual([
      { from: '/srv/logs/server-errors.log', to: '/srv/logs/server-errors.1.log' },
    ])
  })
})

describe('appendErrorLogLine', () => {
  it('creates the directory and appends the line to one reused descriptor', async () => {
    const { fs, sink } = await loadSink()

    sink.appendErrorLogLine('{"a":1}\n')
    sink.appendErrorLogLine('{"a":2}\n')

    expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true })
    expect(fs.openSync).toHaveBeenCalledTimes(1)
    expect(fs.writeSync.mock.calls).toEqual([
      [FD, '{"a":1}\n'],
      [FD, '{"a":2}\n'],
    ])
  })

  it('seeds its byte count from the existing file, so a restart does not reset the cap', async () => {
    const { fs, sink } = await loadSink()
    fsState.fileSize = sink.MAX_LOG_BYTES

    sink.appendErrorLogLine('{"a":1}\n')

    expect(fs.renameSync).toHaveBeenCalled()
  })

  it('does not rotate below the cap', async () => {
    const { fs, sink } = await loadSink()
    fsState.fileSize = sink.MAX_LOG_BYTES - 100

    sink.appendErrorLogLine('{"a":1}\n')

    expect(fs.renameSync).not.toHaveBeenCalled()
    expect(fs.writeSync).toHaveBeenCalledTimes(1)
  })
})

describe('appendErrorLogLine — rotation', () => {
  it('closes the descriptor before the first rename, and reopens after', async () => {
    const { fs, sink } = await loadSink()
    fsState.fileSize = sink.MAX_LOG_BYTES

    sink.appendErrorLogLine('{"a":1}\n')

    // Load-bearing, not tidiness: Windows refuses to rename a file that is still open, so a
    // rotation that closed afterwards would fail on every developer machine here
    const closed = fs.closeSync.mock.invocationCallOrder[0] ?? Infinity
    const renamed = fs.renameSync.mock.invocationCallOrder[0] ?? 0
    expect(closed).toBeLessThan(renamed)
    expect(fs.openSync).toHaveBeenCalledTimes(2)
  })

  it('still writes the line that triggered the rotation', async () => {
    const { fs, sink } = await loadSink()
    fsState.fileSize = sink.MAX_LOG_BYTES

    sink.appendErrorLogLine('{"a":1}\n')

    expect(fs.writeSync).toHaveBeenCalledWith(FD, '{"a":1}\n')
  })

  it('drops the oldest generation and shifts the rest', async () => {
    const { fs, sink } = await loadSink()
    fsState.fileSize = sink.MAX_LOG_BYTES

    sink.appendErrorLogLine('{"a":1}\n')

    expect(fs.rmSync).toHaveBeenCalledWith(expect.any(String), { force: true })
    expect(fs.renameSync).toHaveBeenCalledTimes(5)
  })

  it('skips a generation that does not exist yet', async () => {
    const { fs, sink } = await loadSink()
    fsState.fileSize = sink.MAX_LOG_BYTES
    fsState.filesExist = false

    sink.appendErrorLogLine('{"a":1}\n')

    expect(fs.renameSync).not.toHaveBeenCalled()
    expect(fs.writeSync).toHaveBeenCalledTimes(1)
  })

  it('rotates once per cap, not once per line', async () => {
    const { fs, sink } = await loadSink()
    fsState.fileSize = sink.MAX_LOG_BYTES

    sink.appendErrorLogLine('{"a":1}\n')
    sink.appendErrorLogLine('{"a":2}\n')

    expect(fs.rmSync).toHaveBeenCalledTimes(1)
    expect(fs.writeSync).toHaveBeenCalledTimes(2)
  })
})

describe('appendErrorLogLine — a sink that cannot write', () => {
  it('never throws, so a logged fault cannot become a second one', async () => {
    const { sink } = await loadSink()
    fsState.failOnWrite = true

    expect(() => sink.appendErrorLogLine('{"a":1}\n')).not.toThrow()
  })

  it('gives up for the process lifetime rather than retrying into the same failure', async () => {
    const { fs, sink } = await loadSink()
    fsState.failOnWrite = true

    sink.appendErrorLogLine('{"a":1}\n')
    fsState.failOnWrite = false
    sink.appendErrorLogLine('{"a":2}\n')

    expect(fs.writeSync).toHaveBeenCalledTimes(1)
  })

  it('releases the descriptor on the way out', async () => {
    const { fs, sink } = await loadSink()
    fsState.failOnWrite = true

    sink.appendErrorLogLine('{"a":1}\n')

    expect(fs.closeSync).toHaveBeenCalledWith(FD)
  })
})
