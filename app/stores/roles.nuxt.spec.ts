import { beforeEach, describe, expect, it } from 'vitest'
import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import { createPinia, setActivePinia } from 'pinia'
import type { IWorkspaceMembership, IWorkspaceRole } from '#shared/types/workspace'
import { useRolesStore } from '~/stores/roles'
import { useWorkspacesStore } from '~/stores/workspaces'
import { buildTableAccess, buildRoleInput } from '~~/test/membership'

const WS = 'k3f9x2m8qa'
const OTHER_WS = 'p7q2w9e4rt'

const buildRole = (id: string, name: string, memberCount = 0): IWorkspaceRole => ({
  id,
  name,
  permissions: [],
  memberCount,
  readableTableCount: 1,
  isWithinCaller: true,
  updatedAt: '2026-02-11T16:30:00.000Z',
})

const membership: IWorkspaceMembership = {
  memberId: 'mem_1',
  isOwner: false,
  permissions: ['ROLES_MANAGE'],
  role: { id: 'rol_mine', name: 'Manager' },
  workspace: { id: 'wsp_1', publicId: WS, name: 'Acme', createdAt: '2026-01-01T00:00:00.000Z' },
}

let membershipRequests = 0
let savedRole: { body: unknown; ifMatch: string | undefined } | null = null

const ACCESS_TABLES = [{ id: 'tbl_deals', name: 'Deals', fields: [] }]
const NO_OVERRIDES = { tables: [], fields: [] }

registerEndpoint(`/api/workspaces/${WS}/roles/tables`, {
  method: 'GET',
  handler: () => ({ tables: ACCESS_TABLES }),
})

registerEndpoint(`/api/workspaces/${WS}/roles/rol_2`, {
  method: 'GET',
  handler: () => ({
    role: buildRole('rol_2', 'Viewer'),
    overrides: { tables: [], fields: [{ fieldId: 'fld_salary', access: 'HIDDEN' }] },
    tables: ACCESS_TABLES,
  }),
})

registerEndpoint(`/api/workspaces/${WS}/roles/rol_2`, {
  method: 'PUT',
  handler: async (event) => {
    // The test server hands headers over as a plain object; `Headers` reads it case-blind
    const headers = new Headers(event.node.req.headers as Record<string, string>)
    savedRole = { body: await readBody(event), ifMatch: headers.get('if-match') ?? undefined }
    return {
      role: { ...buildRole('rol_2', 'Reader'), updatedAt: '2026-03-01T10:00:00.000Z' },
      overrides: NO_OVERRIDES,
      tables: ACCESS_TABLES,
    }
  },
})

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
  handler: async (event) => {
    const { name, permissions } = await readBody(event)
    return {
      role: { ...buildRole('rol_new', ''), name, permissions },
      overrides: NO_OVERRIDES,
      tables: ACCESS_TABLES,
    }
  },
})

registerEndpoint(`/api/workspaces/${WS}/roles/rol_mine`, {
  method: 'PUT',
  handler: () => ({
    role: buildRole('rol_mine', 'Lead', 1),
    overrides: NO_OVERRIDES,
    tables: ACCESS_TABLES,
  }),
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
    savedRole = null
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

    await store.createRole(
      WS,
      buildRoleInput(
        'Clerk',
        [],
        [{ tableId: 'tbl_deals', ...buildTableAccess({ canCreate: true }) }],
      ),
    )
    await store.updateRole(WS, buildRole('rol_2', 'Editor'), buildRoleInput('Reader'))
    expect(store.roles.map((role) => role.name)).toEqual(['Manager', 'Reader', 'Clerk'])

    await store.deleteRole(WS, 'rol_2')
    expect(store.roles.map((role) => role.name)).toEqual(['Manager', 'Clerk'])
  })

  it('leaves a list it no longer holds alone', async () => {
    const store = useRolesStore()
    await store.fetchRoles(OTHER_WS)

    await store.createRole(WS, buildRoleInput('Clerk'))

    expect(store.roles.map((role) => role.name)).toEqual(['Elsewhere'])
  })

  it('reloads the caller’s membership when their own role changes, and only then', async () => {
    const store = useRolesStore()
    await store.fetchRoles(WS)

    await store.updateRole(WS, buildRole('rol_2', 'Editor'), buildRoleInput('Reader'))
    expect(membershipRequests).toBe(0)

    await store.updateRole(WS, buildRole('rol_mine', 'Mine'), buildRoleInput('Lead'))
    expect(membershipRequests).toBe(1)
    expect(useWorkspacesStore().findMembership(WS)?.role.name).toBe('Lead')
  })

  it('reads a role with its rows and the tables to set them on', async () => {
    const detail = await useRolesStore().fetchRole(WS, 'rol_2')

    expect(detail.overrides.fields).toEqual([{ fieldId: 'fld_salary', access: 'HIDDEN' }])
    expect(detail.tables.map((table) => table.name)).toEqual(['Deals'])
  })

  it('reads the tables a new role is set on', async () => {
    const tables = await useRolesStore().fetchAccessTables(WS)

    expect(tables.map((table) => table.name)).toEqual(['Deals'])
  })

  it('saves a whole role at the version read, and puts the saved role in the list', async () => {
    const store = useRolesStore()
    await store.fetchRoles(WS)
    const input = {
      ...buildRoleInput('Reader'),
      fields: [{ fieldId: 'fld_salary', access: 'READ' as const }],
    }

    await store.updateRole(WS, buildRole('rol_2', 'Viewer'), input)

    expect(savedRole).toEqual({ body: input, ifMatch: '"2026-02-11T16:30:00.000Z"' })
    expect(store.roles.find((role) => role.id === 'rol_2')?.updatedAt).toBe(
      '2026-03-01T10:00:00.000Z',
    )
    expect(membershipRequests).toBe(0)
  })
})
