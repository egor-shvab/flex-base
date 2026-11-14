import { beforeEach, describe, expect, it, vi } from 'vitest'
import { recordBackgroundFailure } from '#server/utils/error-log-file'
import { toFieldOptions } from '#server/db/fields'

vi.mock('#server/utils/error-log-file', () => ({ recordBackgroundFailure: vi.fn() }))

beforeEach(() => vi.mocked(recordBackgroundFailure).mockClear())

describe('toFieldOptions', () => {
  it('reads a well-formed shape as stored', () => {
    expect(
      toFieldOptions('fld_ok', { targetTableId: 'tbl_people', labelFieldKey: 'full_name' }),
    ).toEqual({ targetTableId: 'tbl_people', labelFieldKey: 'full_name' })
    expect(recordBackgroundFailure).not.toHaveBeenCalled()
  })

  it('reads no options as none', () => {
    expect(toFieldOptions('fld_plain', null)).toBeNull()
  })

  it('reads a malformed shape as none, and records it once per field rather than per read', () => {
    const broken = { choices: 'Won,Lost' }

    expect(toFieldOptions('fld_broken', broken)).toBeNull()
    expect(toFieldOptions('fld_broken', broken)).toBeNull()

    expect(recordBackgroundFailure).toHaveBeenCalledTimes(1)
    expect(String(vi.mocked(recordBackgroundFailure).mock.calls[0]?.[0])).toContain('fld_broken')
  })
})
