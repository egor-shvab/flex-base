import { describe, expect, it } from 'vitest'
import {
  applyReadScope,
  buildAssignableRoleOptions,
  buildScopeOptions,
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

  it('names an own-records scope as such, and a narrowed read even without grants', () => {
    expect(
      summarisePermissions({
        permissions: [],
        recordDefaults: buildRecordDefaults({ canCreate: true, updateScope: 'OWN' }),
      }),
    ).toBe('Add records, Edit own records')
    expect(
      summarisePermissions({
        permissions: [],
        recordDefaults: buildRecordDefaults({ readScope: 'OWN' }),
      }),
    ).toBe('Sees only own records')
  })

  it('does not call a role with every permission but own-records scopes every permission', () => {
    expect(
      summarisePermissions({
        permissions: [...WORKSPACE_PERMISSIONS],
        recordDefaults: { ...FULL_TABLE_ACCESS, deleteScope: 'OWN' },
      }),
    ).not.toBe('Every permission')
  })
})

describe('toGrantCount', () => {
  it('counts permissions and record actions, a wider scope as more', () => {
    const editor = { permissions: [], recordDefaults: buildRecordDefaults({ updateScope: 'ALL' }) }
    const ownEditor = {
      permissions: [],
      recordDefaults: buildRecordDefaults({ updateScope: 'OWN' }),
    }
    const manager = {
      permissions: ['TABLES_MANAGE' as const],
      recordDefaults: buildRecordDefaults({ updateScope: 'ALL' }),
    }

    expect(toGrantCount(ownEditor)).toBeLessThan(toGrantCount(editor))
    expect(toGrantCount(editor)).toBeLessThan(toGrantCount(manager))
  })
})

describe('applyReadScope', () => {
  const editor: TRoleInput['recordDefaults'] = {
    readScope: 'ALL',
    canCreate: true,
    updateScope: 'ALL',
    deleteScope: 'OWN',
  }

  it('narrows the actions to the new read, so none reaches records the role cannot see', () => {
    expect(applyReadScope(editor, 'OWN')).toEqual({
      readScope: 'OWN',
      canCreate: true,
      updateScope: 'OWN',
      deleteScope: 'OWN',
    })
  })

  it('leaves the actions alone when the read widens', () => {
    expect(applyReadScope({ ...editor, readScope: 'OWN', updateScope: 'OWN' }, 'ALL')).toEqual({
      ...editor,
      updateScope: 'OWN',
    })
  })
})

describe('buildScopeOptions', () => {
  it('shows every scope, disabling those past the limit', () => {
    expect(
      buildScopeOptions(['NONE', 'OWN', 'ALL'], (scope) => scope !== 'ALL').map((option) => [
        option.value,
        option.disabled,
      ]),
    ).toEqual([
      ['NONE', false],
      ['OWN', false],
      ['ALL', true],
    ])
  })
})

describe('buildAssignableRoleOptions', () => {
  const role = (id: string, name: string, isWithinCaller: boolean) => ({
    id,
    name,
    permissions: [],
    recordDefaults: buildRecordDefaults(),
    memberCount: 0,
    isWithinCaller,
    updatedAt: '2026-02-11T16:30:00.000Z',
  })

  it('offers only the roles within the caller, in their order', () => {
    const roles = [
      role('rol_admin', 'Admin', false),
      role('rol_editor', 'Editor', true),
      role('rol_viewer', 'Viewer', true),
    ]

    expect(buildAssignableRoleOptions(roles)).toEqual([
      { value: 'rol_editor', label: 'Editor' },
      { value: 'rol_viewer', label: 'Viewer' },
    ])
  })
})
