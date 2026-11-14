import { describe, expect, it } from 'vitest'
import { createLatestRequest } from '~/utils/latest-request'

describe('createLatestRequest', () => {
  it('keeps the one request in flight current', () => {
    const ticket = createLatestRequest().start()

    expect(ticket.isCurrent()).toBe(true)
    expect(ticket.signal.aborted).toBe(false)
  })

  it('aborts and retires the previous request when a new one starts', () => {
    const latest = createLatestRequest()
    const older = latest.start()
    const newer = latest.start()

    expect(older.signal.aborted).toBe(true)
    expect(older.isCurrent()).toBe(false)
    expect(newer.isCurrent()).toBe(true)
  })

  it('retires the request in flight on cancel, so nothing it answers is applied', () => {
    const latest = createLatestRequest()
    const ticket = latest.start()

    latest.cancel()

    expect(ticket.signal.aborted).toBe(true)
    expect(ticket.isCurrent()).toBe(false)
  })
})
