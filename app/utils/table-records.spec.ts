import { describe, expect, it } from 'vitest'
import type { ITableListItem } from '#shared/types/table'
import { toRecordTotal } from '~/utils/table-records'

const table = (records: number | null): ITableListItem => ({
  id: 'tbl_1',
  number: 1,
  name: 'Deals',
  createdAt: '2026-01-05T09:14:00.000Z',
  updatedAt: '2026-01-05T09:14:00.000Z',
  _count: { fields: 0, records },
})

describe('toRecordTotal', () => {
  it('adds up every table’s records', () => {
    expect(toRecordTotal([table(2), table(3)])).toBe(5)
    expect(toRecordTotal([])).toBe(0)
  })

  it('withholds the total once any table’s count is withheld', () => {
    expect(toRecordTotal([table(2), table(null)])).toBeNull()
  })
})
