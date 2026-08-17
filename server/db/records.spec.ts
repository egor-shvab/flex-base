import { describe, expect, it } from 'vitest'
import type { Prisma } from '#server/generated/prisma/client'
import { toSharedRecord } from '#server/db/records'

/** A row as Prisma returns it — `data` as opaque JSON, timestamps as `Date`. */
function row(overrides: Partial<{ id: string; number: number; data: Prisma.JsonValue }> = {}) {
  return {
    id: 'rec_1',
    number: 1,
    data: { company: 'Acme' },
    createdAt: new Date('2026-01-05T09:14:00.000Z'),
    updatedAt: new Date('2026-02-11T16:30:00.000Z'),
    ...overrides,
  }
}

describe('toSharedRecord', () => {
  it('renders the timestamps as ISO strings, which is what the wire carries', () => {
    expect(toSharedRecord(row())).toMatchObject({
      createdAt: '2026-01-05T09:14:00.000Z',
      updatedAt: '2026-02-11T16:30:00.000Z',
    })
  })

  it('reads a JSON null column as an empty record rather than passing null on', () => {
    expect(toSharedRecord(row({ data: null })).data).toEqual({})
  })

  it('keeps the stored data otherwise', () => {
    expect(toSharedRecord(row()).data).toEqual({ company: 'Acme' })
  })
})
