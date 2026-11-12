import { beforeEach, describe, expect, it } from 'vitest'
import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import { createPinia, setActivePinia } from 'pinia'
import type { IWorkspaceMembership, IWorkspaceRole } from '#shared/types/workspace'
import { useRolesStore } from '~/stores/roles'
import { useWorkspacesStore } from '~/stores/workspaces'

const WS = 'k3f9x2m8qa'
const OTHER_WS = 'p7q2w9e4rt'

const buildRole = (id: string, name: string, memberCount = 0): IWorkspaceRole => ({
  id,
  name,
  permissions: [],
  memberCount,
})

const membership: IWorkspaceMembership = {
  memberId: 'mem_1',
  isOwner: false,
  permissions: ['ROLES_MANAGE'],
  role: { id: 'rol_mine', name: 'Manager' },
  workspace: { id: 'wsp_1', publicId: WS, name: 'Acme', createdAt: '2026-01-01T00:00:00.000Z' },
}

let membershipRequests = 0

registerEndpoint(`/api/workspaces/${WS}/roles`, {
  method: 'GET',
  handler: () => ({ roles: [buildRole('rol_mine', 'Manager', 1), buildRole('rol_2', 'Viewer')] }),
})

registerEndpoint(`/api/workspaces/${OTHER_WS}/roles`, {
  method: 'GET',
  handler: () => ({ roles: [buildRole('rol_9', 'Elsewhere')] }),
})

registerEndpoint(`/api/workspaces/${WS}/roles`, {
  method: 'POST',
  handler: async (event) => ({ role: { ...buildRole('rol_new', ''), ...(await readBody(event)) } }),
})

registerEndpoint(`/api/workspaces/${WS}/roles/rol_2`, {
  method: 'PATCH',
  handler: () => ({ role: buildRole('rol_2', 'Reader') }),
})

registerEndpoint(`/api/workspaces/${WS}/roles/rol_mine`, {
  method: 'PATCH',
  handler: () => ({ role: buildRole('rol_mine', 'Lead', 1) }),
})

registerEndpoint(`/api/workspaces/${WS}/roles/rol_2`, {
  method: 'DELETE',
  handler: () => ({ ok: true }),
})

registerEndpoint(`/api/workspaces/${WS}`, {
  method: 'GET',
  handler: () => {
    membershipRequests += 1
    return { membership: { ...membership, role: { id: 'rol_mine', name: 'Lead' } } }
  },
})

describe('useRolesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    membershipRequests = 0
    useWorkspacesStore().memberships = [membership]
  })

  it('holds the roles of the workspace last fetched', async () => {
    const store = useRolesStore()

    await store.fetchRoles(WS)
    expect(store.roles.map((role) => role.name)).toEqual(['Manager', 'Viewer'])

    await store.fetchRoles(OTHER_WS)
    expect(store.roles.map((role) => role.name)).toEqual(['Elsewhere'])
  })

  it('adds, replaces and removes a role in place', async () => {
    const store = useRolesStore()
    await store.fetchRoles(WS)

    await store.createRole(WS, { name: 'Clerk', permissions: ['RECORDS_CREATE'] })
    await store.updateRole(WS, 'rol_2', { name: 'Reader', permissions: [] })
    expect(store.roles.map((role) => role.name)).toEqual(['Manager', 'Reader', 'Clerk'])

    await store.deleteRole(WS, 'rol_2')
    expect(store.roles.map((role) => role.name)).toEqual(['Manager', 'Clerk'])
  })

  it('leaves a list it no longer holds alone', async () => {
    const store = useRolesStore()
    await store.fetchRoles(OTHER_WS)

    await store.createRole(WS, { name: 'Clerk', permissions: [] })

    expect(store.roles.map((role) => role.name)).toEqual(['Elsewhere'])
  })

  it('reloads the caller’s membership when their own role changes, and only then', async () => {
    const store = useRolesStore()
    await store.fetchRoles(WS)

    await store.updateRole(WS, 'rol_2', { name: 'Reader', permissions: [] })
    expect(membershipRequests).toBe(0)

    await store.updateRole(WS, 'rol_mine', { name: 'Lead', permissions: [] })
    expect(membershipRequests).toBe(1)
    expect(useWorkspacesStore().findMembership(WS)?.role.name).toBe('Lead')
  })
})
