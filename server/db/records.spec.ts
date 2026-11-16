import { describe, expect, it } from 'vitest'
import type { Prisma } from '#server/generated/prisma/client'
import { toSharedRecord } from '#server/db/records'
import { textField } from '~~/test/fixtures'

const FIELDS = [textField('company')]

function row(overrides: Partial<{ id: string; number: number; data: Prisma.JsonValue }> = {}) {
  return {
    id: 'rec_1',
    number: 1,
    createdById: 'usr_1',
    data: { company: 'Acme' },
    createdAt: new Date('2026-01-05T09:14:00.000Z'),
    updatedAt: new Date('2026-02-11T16:30:00.000Z'),
    ...overrides,
  }
}

describe('toSharedRecord', () => {
  it('renders the timestamps as ISO strings, which is what the wire carries', () => {
    expect(toSharedRecord(row(), FIELDS)).toMatchObject({
      createdAt: '2026-01-05T09:14:00.000Z',
      updatedAt: '2026-02-11T16:30:00.000Z',
    })
  })

  it('reads a JSON null column as an empty record rather than passing null on', () => {
    expect(toSharedRecord(row({ data: null }), FIELDS).data).toEqual({})
  })

  it('keeps the stored data otherwise', () => {
    expect(toSharedRecord(row(), FIELDS).data).toEqual({ company: 'Acme' })
  })

  it('leaves out every key but the caller’s visible fields, so a hidden value never leaves', () => {
    const stored = row({ data: { company: 'Acme', salary: 90000, stale: 'x' } })

    expect(toSharedRecord(stored, FIELDS).data).toEqual({ company: 'Acme' })
    expect(toSharedRecord(stored, []).data).toEqual({})
  })
})
