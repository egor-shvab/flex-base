import { describe, expect, it } from 'vitest'
import { summarisePermissions } from '~/utils/workspace-permissions'
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
