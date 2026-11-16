import { describe, expect, it } from 'vitest'
import {
  applyRecordAction,
  buildAssignableRoleOptions,
  summarisePermissions,
  toGrantCount,
} from '~/utils/workspace-permissions'
import { FULL_TABLE_ACCESS, WORKSPACE_PERMISSIONS } from '#shared/constants/workspace'
import type { TRoleInput } from '#shared/validation/workspace'
import { buildRecordDefaults } from '~~/test/membership'

describe('summarisePermissions', () => {
  it('calls a role without grants read only, since every member may read', () => {
    expect(summarisePermissions({ permissions: [], recordDefaults: buildRecordDefaults() })).toBe(
      'Read only',
    )
  })

  it('says every permission rather than listing all of them', () => {
    expect(
      summarisePermissions({
        permissions: [...WORKSPACE_PERMISSIONS].reverse(),
        recordDefaults: FULL_TABLE_ACCESS,
      }),
    ).toBe('Every permission')
  })

  it('lists the rest in the editor’s order, whatever order they arrive in', () => {
    expect(
      summarisePermissions({
        permissions: ['TABLES_MANAGE', 'WORKSPACE_UPDATE'],
        recordDefaults: buildRecordDefaults({ deleteScope: 'ALL' }),
      }),
    ).toBe('Rename the workspace, Manage tables, Delete records')
  })
})

describe('toGrantCount', () => {
  it('counts permissions and record actions alike', () => {
    expect(
      toGrantCount({
        permissions: ['TABLES_MANAGE'],
        recordDefaults: buildRecordDefaults({ canCreate: true, updateScope: 'ALL' }),
      }),
    ).toBe(3)
  })
})

describe('applyRecordAction', () => {
  const readOnly: TRoleInput['recordDefaults'] = {
    readScope: 'ALL',
    canCreate: false,
    updateScope: 'NONE',
    deleteScope: 'NONE',
  }

  it('grants adding as a flag and the other actions on every record', () => {
    expect(applyRecordAction(readOnly, 'create', true)).toEqual({ ...readOnly, canCreate: true })
    expect(applyRecordAction(readOnly, 'update', true)).toEqual({ ...readOnly, updateScope: 'ALL' })
    expect(applyRecordAction(readOnly, 'delete', true)).toEqual({ ...readOnly, deleteScope: 'ALL' })
  })

  it('withdraws an action without touching the others', () => {
    const editor = { ...readOnly, canCreate: true, updateScope: 'ALL' as const }

    expect(applyRecordAction(editor, 'update', false)).toEqual({ ...readOnly, canCreate: true })
  })
})

describe('buildAssignableRoleOptions', () => {
  const roles = [
    {
      id: 'rol_admin',
      name: 'Admin',
      permissions: [...WORKSPACE_PERMISSIONS],
      recordDefaults: FULL_TABLE_ACCESS,
      memberCount: 1,
      updatedAt: '2026-02-11T16:30:00.000Z',
    },
    {
      id: 'rol_editor',
      name: 'Editor',
      permissions: [],
      recordDefaults: buildRecordDefaults({ canCreate: true }),
      memberCount: 0,
      updatedAt: '2026-02-11T16:30:00.000Z',
    },
    {
      id: 'rol_viewer',
      name: 'Viewer',
      permissions: [],
      recordDefaults: buildRecordDefaults(),
      memberCount: 0,
      updatedAt: '2026-02-11T16:30:00.000Z',
    },
  ]

  it('offers only the roles within the actor’s permissions, in their order', () => {
    const actor = {
      memberId: 'mem_1',
      isOwner: false,
      permissions: [],
      recordDefaults: buildRecordDefaults({ canCreate: true }),
    }

    expect(buildAssignableRoleOptions(actor, roles)).toEqual([
      { value: 'rol_editor', label: 'Editor' },
      { value: 'rol_viewer', label: 'Viewer' },
    ])
  })

  it('offers the owner every role', () => {
    const owner = {
      memberId: 'mem_1',
      isOwner: true,
      permissions: [],
      recordDefaults: buildRecordDefaults(),
    }

    expect(buildAssignableRoleOptions(owner, roles)).toHaveLength(3)
  })
})
