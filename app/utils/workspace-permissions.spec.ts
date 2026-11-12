import { describe, expect, it } from 'vitest'
import { buildAssignableRoleOptions, summarisePermissions } from '~/utils/workspace-permissions'
import { WORKSPACE_PERMISSIONS } from '#shared/constants/workspace'

describe('summarisePermissions', () => {
  it('calls a role without permissions read only, since every member may read', () => {
    expect(summarisePermissions([])).toBe('Read only')
  })

  it('says every permission rather than listing all of them', () => {
    expect(summarisePermissions([...WORKSPACE_PERMISSIONS].reverse())).toBe('Every permission')
  })

  it('lists the rest in the editor’s order, whatever order they arrive in', () => {
    expect(summarisePermissions(['RECORDS_DELETE', 'TABLES_MANAGE'])).toBe(
      'Manage tables, Delete records',
    )
  })
})

describe('buildAssignableRoleOptions', () => {
  const roles = [
    { id: 'rol_admin', name: 'Admin', permissions: [...WORKSPACE_PERMISSIONS], memberCount: 1 },
    { id: 'rol_editor', name: 'Editor', permissions: ['RECORDS_CREATE' as const], memberCount: 0 },
    { id: 'rol_viewer', name: 'Viewer', permissions: [], memberCount: 0 },
  ]

  it('offers only the roles within the actor’s permissions, in their order', () => {
    const actor = { memberId: 'mem_1', isOwner: false, permissions: ['RECORDS_CREATE' as const] }

    expect(buildAssignableRoleOptions(actor, roles)).toEqual([
      { value: 'rol_editor', label: 'Editor' },
      { value: 'rol_viewer', label: 'Viewer' },
    ])
  })

  it('offers the owner every role', () => {
    const owner = { memberId: 'mem_1', isOwner: true, permissions: [] }

    expect(buildAssignableRoleOptions(owner, roles)).toHaveLength(3)
  })
})
