import { beforeEach, describe, expect, it } from 'vitest'
import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError } from 'h3'
import { createPinia, setActivePinia } from 'pinia'
import type { IWorkspaceMembership } from '#shared/types/workspace'
import { useAuthStore } from '~/stores/auth'
import { useWorkspacesStore } from '~/stores/workspaces'

const WS = 'k3f9x2m8qa'
const OTHER_WS = 'p7q2w9e4rt'
const NEW_WS = 'n3w4w0rksp'

function buildMembership(publicId: string, name = 'Acme'): IWorkspaceMembership {
  return {
    memberId: `mem_${publicId}`,
    isOwner: true,
    permissions: [],
    role: { id: 'rol_1', name: 'Admin' },
    workspace: { id: `wsp_${publicId}`, publicId, name, createdAt: '2026-01-01T00:00:00.000Z' },
  }
}

let listing: IWorkspaceMembership[] = []
let listShouldFail = false
const calls: string[] = []

registerEndpoint('/api/workspaces', {
  method: 'GET',
  handler: () => {
    calls.push('GET /api/workspaces')
    // A 4xx: `ofetch` retries a GET once on 5xx, which would muddle the request count
    if (listShouldFail) throw createError({ statusCode: 409, statusMessage: 'Unavailable' })
    return { memberships: listing, lastWorkspaceAddress: OTHER_WS }
  },
})

registerEndpoint('/api/workspaces', {
  method: 'POST',
  handler: () => ({ membership: buildMembership(NEW_WS, 'Side project') }),
})

registerEndpoint(`/api/workspaces/${NEW_WS}`, {
  method: 'GET',
  handler: () => ({ membership: buildMembership(NEW_WS, 'Made elsewhere') }),
})

registerEndpoint(`/api/workspaces/${WS}`, {
  method: 'GET',
  handler: () => ({ membership: { ...buildMembership(WS), isOwner: false } }),
})

registerEndpoint(`/api/workspaces/${WS}`, {
  method: 'PATCH',
  handler: () => ({ workspace: { ...buildMembership(WS).workspace, name: 'Renamed' } }),
})

registerEndpoint(`/api/workspaces/${OTHER_WS}`, {
  method: 'DELETE',
  handler: () => ({ ok: true }),
})

registerEndpoint(`/api/workspaces/${WS}/visit`, {
  method: 'PUT',
  handler: () => {
    calls.push('PUT visit')
    return { ok: true }
  },
})

describe('useWorkspacesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    listing = [buildMembership(WS), buildMembership(OTHER_WS, 'Other')]
    listShouldFail = false
    calls.length = 0
  })

  it('fetches the memberships and the remembered workspace', async () => {
    const store = useWorkspacesStore()

    await store.fetchWorkspaces()

    expect(store.memberships).toEqual(listing)
    expect(store.lastWorkspaceAddress).toBe(OTHER_WS)
    expect(store.status).toBe('ready')
  })

  it('loads once for the same user', async () => {
    const store = useWorkspacesStore()

    await store.ensureWorkspaces()
    await store.ensureWorkspaces()

    expect(calls).toHaveLength(1)
  })

  it('loads again, emptied first, once someone else has signed in', async () => {
    const store = useWorkspacesStore()
    const auth = useAuthStore()
    auth.user = { id: 'usr_ada', email: 'ada@example.com', name: 'Ada' }
    await store.ensureWorkspaces()

    auth.user = { id: 'usr_bob', email: 'bob@example.com', name: 'Bob' }
    listing = [buildMembership(NEW_WS, 'Bob’s')]
    const loading = store.ensureWorkspaces()

    expect(store.memberships).toEqual([])
    await loading
    expect(calls).toHaveLength(2)
    expect(store.memberships.map((membership) => membership.workspace.name)).toEqual(['Bob’s'])
  })

  it('never throws from ensureWorkspaces, reporting failure on the store instead', async () => {
    listShouldFail = true
    const store = useWorkspacesStore()

    await expect(store.ensureWorkspaces()).resolves.toBeUndefined()

    expect(store.status).toBe('failed')
  })

  it('adds a created workspace to the list', async () => {
    const store = useWorkspacesStore()
    await store.fetchWorkspaces()

    const created = await store.createWorkspace({ name: 'Side project' })

    expect(created.workspace.publicId).toBe(NEW_WS)
    expect(store.findMembership(NEW_WS)?.workspace.name).toBe('Side project')
  })

  it('keeps a renamed workspace’s new name', async () => {
    const store = useWorkspacesStore()
    await store.fetchWorkspaces()

    await store.renameWorkspace(WS, { name: 'Renamed' })

    expect(store.findMembership(WS)?.workspace.name).toBe('Renamed')
  })

  it('drops a deleted workspace, and forgets it as the last one', async () => {
    const store = useWorkspacesStore()
    await store.fetchWorkspaces()

    await store.deleteWorkspace(OTHER_WS)

    expect(store.findMembership(OTHER_WS)).toBeUndefined()
    expect(store.lastWorkspaceAddress).toBeNull()
  })

  it('refreshes a held membership from the workspace’s own answer', async () => {
    const store = useWorkspacesStore()
    await store.fetchWorkspaces()

    await store.fetchMembership(WS)

    expect(store.memberships).toHaveLength(2)
    expect(store.findMembership(WS)?.isOwner).toBe(false)
  })

  it('adds a membership the list did not hold, as one made in another tab', async () => {
    const store = useWorkspacesStore()
    await store.fetchWorkspaces()

    await store.fetchMembership(NEW_WS)

    expect(store.findMembership(NEW_WS)?.workspace.name).toBe('Made elsewhere')
  })

  it('remembers the last workspace on the server and at once here', async () => {
    const store = useWorkspacesStore()
    await store.fetchWorkspaces()

    const remembering = store.rememberLastWorkspace(WS)

    expect(store.lastWorkspaceAddress).toBe(WS)
    await remembering
    expect(calls).toContain('PUT visit')
  })
})
