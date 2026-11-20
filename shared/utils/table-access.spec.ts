import { describe, expect, it } from 'vitest'
import { buildTableAccess } from '~~/test/membership'
import { FULL_TABLE_ACCESS, NO_TABLE_ACCESS } from '#shared/constants/workspace'
import type { IWorkspaceActor } from '#shared/types/workspace'
import {
  canCountRecords,
  canDeleteRecord,
  canReadRecords,
  canUpdateRecord,
  isTableVisibilityBypassed,
  resolveFieldAccess,
  resolveTableAccess,
} from '#shared/utils/table-access'

const actor = (overrides: Partial<IWorkspaceActor> = {}): IWorkspaceActor => ({
  memberId: 'mem_1',
  isOwner: false,
  permissions: [],
  ...overrides,
})

const hidden = buildTableAccess({ readScope: 'NONE' })

describe('resolveTableAccess', () => {
  it('grants nothing on a table the role has no row for', () => {
    expect(resolveTableAccess(actor(), null)).toEqual(NO_TABLE_ACCESS)
  })

  it('takes the table’s row whole, narrow or wide', () => {
    const narrower = buildTableAccess({ readScope: 'OWN' })
    const wider = buildTableAccess({ canCreate: true, updateScope: 'ALL', deleteScope: 'ALL' })

    expect(resolveTableAccess(actor(), narrower)).toEqual(narrower)
    expect(resolveTableAccess(actor(), wider)).toEqual(wider)
  })

  it('gives the owner everything, whatever the role or the table’s row says', () => {
    expect(resolveTableAccess(actor({ isOwner: true }), hidden)).toEqual(FULL_TABLE_ACCESS)
  })

  it('lets a schema manager read a table hidden from their role, and nothing more', () => {
    const manager = actor({ permissions: ['TABLES_MANAGE'] })

    expect(resolveTableAccess(manager, hidden)).toEqual({ ...hidden, readScope: 'ALL' })
    expect(resolveTableAccess(manager, null)).toEqual({ ...NO_TABLE_ACCESS, readScope: 'ALL' })
  })
})

describe('isTableVisibilityBypassed', () => {
  it('holds for the owner and a schema manager only', () => {
    expect(isTableVisibilityBypassed(actor({ isOwner: true }))).toBe(true)
    expect(isTableVisibilityBypassed(actor({ permissions: ['TABLES_MANAGE'] }))).toBe(true)
    expect(isTableVisibilityBypassed(actor({ permissions: ['ROLES_MANAGE'] }))).toBe(false)
  })
})

describe('canReadRecords', () => {
  it.each([
    ['NONE', false],
    ['OWN', true],
    ['ALL', true],
  ] as const)('reads a table scoped to %s: %s', (readScope, expected) => {
    expect(canReadRecords(buildTableAccess({ readScope }))).toBe(expected)
  })
})

describe('canCountRecords', () => {
  it('shows a table’s count only to a caller who reads all of it', () => {
    expect(canCountRecords(buildTableAccess({ readScope: 'ALL' }))).toBe(true)
    expect(canCountRecords(buildTableAccess({ readScope: 'OWN' }))).toBe(false)
  })
})

describe('canUpdateRecord and canDeleteRecord', () => {
  const mine = { createdById: 'usr_me' }
  const theirs = { createdById: 'usr_other' }
  const orphan = { createdById: null }

  it.each([
    ['NONE', [false, false, false]],
    ['OWN', [true, false, false]],
    ['ALL', [true, true, true]],
  ] as const)('under %s reach mine, theirs and an orphan: %j', (scope, expected) => {
    const update = buildTableAccess({ updateScope: scope })
    const remove = buildTableAccess({ deleteScope: scope })

    expect([mine, theirs, orphan].map((r) => canUpdateRecord(update, r, 'usr_me'))).toEqual(
      expected,
    )
    expect([mine, theirs, orphan].map((r) => canDeleteRecord(remove, r, 'usr_me'))).toEqual(
      expected,
    )
  })
})

describe('resolveFieldAccess', () => {
  const readOnly = buildTableAccess()
  const writer = buildTableAccess({ updateScope: 'OWN' })

  it('follows the table: edit where the role writes records, read where it does not', () => {
    expect(resolveFieldAccess(actor(), writer, null)).toBe('EDIT')
    expect(resolveFieldAccess(actor(), buildTableAccess({ canCreate: true }), null)).toBe('EDIT')
    expect(resolveFieldAccess(actor(), readOnly, null)).toBe('READ')
  })

  it('lets the field’s row narrow it', () => {
    expect(resolveFieldAccess(actor(), writer, 'HIDDEN')).toBe('HIDDEN')
    expect(resolveFieldAccess(actor(), writer, 'READ')).toBe('READ')
  })

  it('shows and opens every field to the owner and a schema manager', () => {
    expect(resolveFieldAccess(actor({ isOwner: true }), readOnly, 'HIDDEN')).toBe('EDIT')
    expect(resolveFieldAccess(actor({ permissions: ['TABLES_MANAGE'] }), readOnly, 'HIDDEN')).toBe(
      'EDIT',
    )
  })
})
