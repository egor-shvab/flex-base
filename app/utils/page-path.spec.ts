import { describe, expect, it } from 'vitest'
import { pagePath } from '~/utils/page-path'

describe('pagePath', () => {
  it('puts every page of a workspace under its address', () => {
    expect(pagePath.workspace('k3f9x2m8qa')).toBe('/w/k3f9x2m8qa')
    expect(pagePath.table('k3f9x2m8qa', '4')).toBe('/w/k3f9x2m8qa/tables/4')
    expect(pagePath.tableSettings('k3f9x2m8qa', '4')).toBe('/w/k3f9x2m8qa/tables/4/settings')
  })

  it('puts a role’s page, and a new role’s, under the roles section of the settings', () => {
    expect(pagePath.newRole('k3f9x2m8qa')).toBe(
      `${pagePath.workspaceSettings('k3f9x2m8qa', 'roles')}/new`,
    )
    expect(pagePath.role('k3f9x2m8qa', 'rol_1')).toBe(
      `${pagePath.workspaceSettings('k3f9x2m8qa', 'roles')}/rol_1`,
    )
  })
})
