import { describe, expect, it } from 'vitest'
import { parseIfMatchVersion } from '#server/utils/if-match'

const ISO = '2026-02-11T16:30:00.123Z'

describe('parseIfMatchVersion', () => {
  it('reads no header as an unconditional write', () => {
    expect(parseIfMatchVersion(undefined)).toBeUndefined()
    expect(parseIfMatchVersion('  ')).toBeUndefined()
  })

  it('reads a quoted timestamp to the millisecond, weak or strong', () => {
    expect(parseIfMatchVersion(`"${ISO}"`)?.toISOString()).toBe(ISO)
    expect(parseIfMatchVersion(`W/"${ISO}"`)?.toISOString()).toBe(ISO)
  })

  it('refuses anything that is not a timestamp with a 400, never passing it as absent', () => {
    expect(() => parseIfMatchVersion('"*"')).toThrow(expect.objectContaining({ statusCode: 400 }))
  })
})
