import { describe, expect, it } from 'vitest'
import { parseRecordVersion } from '#server/utils/record-version'

const ISO = '2026-02-11T16:30:00.123Z'

describe('parseRecordVersion', () => {
  it('reads no header as an unconditional write', () => {
    expect(parseRecordVersion(undefined)).toBeUndefined()
    expect(parseRecordVersion('  ')).toBeUndefined()
  })

  it('reads a quoted timestamp to the millisecond, weak or strong', () => {
    expect(parseRecordVersion(`"${ISO}"`)?.toISOString()).toBe(ISO)
    expect(parseRecordVersion(`W/"${ISO}"`)?.toISOString()).toBe(ISO)
  })

  it('refuses anything that is not a timestamp with a 400, never passing it as absent', () => {
    expect(() => parseRecordVersion('"*"')).toThrow(expect.objectContaining({ statusCode: 400 }))
  })
})
