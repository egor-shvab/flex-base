import { describe, expect, it } from 'vitest'
import {
  applyReadScope,
  buildAssignableRoleOptions,
  buildScopeOptions,
  summarisePermissions,
  toGrantCount,
} from '~/utils/workspace-permissions'
import { WORKSPACE_PERMISSIONS } from '#shared/constants/workspace'
import type { ITableAccess, IWorkspaceRole } from '#shared/types/workspace'

const role = (
  overrides: Partial<IWorkspaceRole> & Pick<IWorkspaceRole, 'id' | 'name'>,
): IWorkspaceRole => ({
  permissions: [],
  memberCount: 0,
  readableTableCount: 0,
  isWithinCaller: true,
  updatedAt: '2026-02-11T16:30:00.000Z',
  ...overrides,
})

describe('summarisePermissions', () => {
  it('says a role that reaches no table reaches none', () => {
    expect(summarisePermissions(role({ id: 'rol_1', name: 'New' }))).toBe('No tables')
  })

  it('says every permission rather than listing all of them, then counts the tables', () => {
    expect(
      summarisePermissions(
        role({
          id: 'rol_1',
          name: 'Lead',
          permissions: [...WORKSPACE_PERMISSIONS].filter((p) => p !== 'TABLES_MANAGE'),
          readableTableCount: 3,
        }),
      ),
    ).toBe(
      'Rename the workspace, Invite members, Manage members, Manage roles, Records in 3 tables',
    )
    expect(
      summarisePermissions(
        role({ id: 'rol_2', name: 'Admin', permissions: [...WORKSPACE_PERMISSIONS].reverse() }),
      ),
    ).toBe('Every permission, Records in every table')
  })

  it('says a role that manages tables reads every table, whatever rows it holds', () => {
    expect(
      summarisePermissions(role({ id: 'rol_1', name: 'Builder', permissions: ['TABLES_MANAGE'] })),
    ).toBe('Manage tables, Records in every table')
  })

  it('lists the rest in the editor’s order, whatever order they arrive in', () => {
    expect(
      summarisePermissions(
        role({
          id: 'rol_1',
          name: 'Clerk',
          permissions: ['TABLES_MANAGE', 'WORKSPACE_UPDATE'],
          readableTableCount: 1,
        }),
      ),
    ).toBe('Rename the workspace, Manage tables, Records in every table')
  })
})

describe('toGrantCount', () => {
  it('counts permissions and the tables a role reaches', () => {
    const viewer = role({ id: 'rol_1', name: 'Viewer', readableTableCount: 1 })
    const editor = role({ id: 'rol_2', name: 'Editor', readableTableCount: 3 })
    const manager = role({
      id: 'rol_3',
      name: 'Manager',
      permissions: ['TABLES_MANAGE'],
      readableTableCount: 3,
    })

    expect(toGrantCount(viewer)).toBeLessThan(toGrantCount(editor))
    expect(toGrantCount(editor)).toBeLessThan(toGrantCount(manager))
  })

  it('ranks a role that manages tables above any count of tables, even with no rows', () => {
    const builder = role({ id: 'rol_1', name: 'Builder', permissions: ['TABLES_MANAGE'] })
    const wide = role({
      id: 'rol_2',
      name: 'Wide',
      permissions: ['MEMBERS_INVITE', 'MEMBERS_MANAGE'],
      readableTableCount: 40,
    })

    expect(toGrantCount(wide)).toBeLessThan(toGrantCount(builder))
  })
})

describe('applyReadScope', () => {
  const editor: ITableAccess = {
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
  it('offers only the roles within the caller, in their order', () => {
    const roles = [
      role({ id: 'rol_admin', name: 'Admin', isWithinCaller: false }),
      role({ id: 'rol_editor', name: 'Editor' }),
      role({ id: 'rol_viewer', name: 'Viewer' }),
    ]

    expect(buildAssignableRoleOptions(roles)).toEqual([
      { value: 'rol_editor', label: 'Editor' },
      { value: 'rol_viewer', label: 'Viewer' },
    ])
  })
})
