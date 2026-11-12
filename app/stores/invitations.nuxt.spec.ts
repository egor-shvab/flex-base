import { beforeEach, describe, expect, it } from 'vitest'
import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError } from 'h3'
import { createPinia, setActivePinia } from 'pinia'
import type {
  IIncomingInvitation,
  IWorkspaceInvitation,
  IWorkspaceMembership,
} from '#shared/types/workspace'
import { useAuthStore } from '~/stores/auth'
import { useInvitationsStore } from '~/stores/invitations'
import { useWorkspacesStore } from '~/stores/workspaces'

const WS = 'k3f9x2m8qa'
const JOINED_WS = 'j0in3dw0rk'

const buildOutgoing = (id: string, email: string, roleName = 'Editor'): IWorkspaceInvitation => ({
  id,
  email,
  role: { id: `rol_${roleName.toLowerCase()}`, name: roleName },
  invitedBy: { id: 'usr_ada', name: 'Ada' },
  expiresAt: '2026-03-08T12:00:00.000Z',
  isExpired: false,
})

const buildIncoming = (id: string, workspaceName: string): IIncomingInvitation => ({
  id,
  workspace: { name: workspaceName },
  role: { name: 'Editor' },
  invitedBy: { id: 'usr_ada', name: 'Ada' },
  expiresAt: '2026-03-08T12:00:00.000Z',
})

const joined: IWorkspaceMembership = {
  memberId: 'mem_new',
  isOwner: false,
  permissions: ['RECORDS_CREATE'],
  role: { id: 'rol_editor', name: 'Editor' },
  workspace: {
    id: 'wsp_j',
    publicId: JOINED_WS,
    name: 'Joined',
    createdAt: '2026-01-01T00:00:00Z',
  },
}

let incomingRequests = 0

registerEndpoint(`/api/workspaces/${WS}/invitations`, {
  method: 'GET',
  handler: () => ({ invitations: [buildOutgoing('inv_1', 'grace@example.com')] }),
})

registerEndpoint(`/api/workspaces/${WS}/invitations`, {
  method: 'POST',
  handler: () => ({ invitation: buildOutgoing('inv_1', 'grace@example.com', 'Viewer') }),
})

registerEndpoint(`/api/workspaces/${WS}/invitations/inv_1`, {
  method: 'DELETE',
  handler: () => ({ ok: true }),
})

registerEndpoint('/api/invitations', {
  method: 'GET',
  handler: () => {
    incomingRequests += 1
    return { invitations: [buildIncoming('inc_ok', 'Joined'), buildIncoming('inc_gone', 'Gone')] }
  },
})

registerEndpoint('/api/invitations/inc_ok/accept', {
  method: 'POST',
  handler: () => ({ membership: joined }),
})

registerEndpoint('/api/invitations/inc_gone/accept', {
  method: 'POST',
  handler: () => {
    throw createError({ statusCode: 404, statusMessage: 'This invitation is no longer valid' })
  },
})

registerEndpoint('/api/invitations/inc_ok', {
  method: 'DELETE',
  handler: () => ({ ok: true }),
})

describe('useInvitationsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    incomingRequests = 0
    useAuthStore().user = { id: 'usr_grace', email: 'grace@example.com', name: 'Grace' }
  })

  it('replaces an invitation sent again, rather than listing it twice', async () => {
    const store = useInvitationsStore()
    await store.fetchInvitations(WS)

    await store.createInvitation(WS, { email: 'grace@example.com', roleId: 'rol_viewer' })

    expect(store.outgoing.map((invitation) => invitation.role.name)).toEqual(['Viewer'])
  })

  it('drops a revoked invitation', async () => {
    const store = useInvitationsStore()
    await store.fetchInvitations(WS)

    await store.revokeInvitation(WS, 'inv_1')

    expect(store.outgoing).toEqual([])
  })

  it('loads the incoming invitations once per user', async () => {
    const store = useInvitationsStore()

    await store.ensureIncoming()
    await store.ensureIncoming()
    expect(incomingRequests).toBe(1)

    useAuthStore().user = { id: 'usr_bob', email: 'bob@example.com', name: 'Bob' }
    await store.ensureIncoming()
    expect(incomingRequests).toBe(2)
  })

  it('joins the workspace on accept, adding it to the switcher', async () => {
    const store = useInvitationsStore()
    await store.fetchIncoming()

    await expect(store.acceptInvitation('inc_ok')).resolves.toEqual(joined)

    expect(store.incoming.map((invitation) => invitation.id)).toEqual(['inc_gone'])
    expect(useWorkspacesStore().findMembership(JOINED_WS)).toEqual(joined)
  })

  it('drops an invitation the server no longer has, and still reports why', async () => {
    const store = useInvitationsStore()
    await store.fetchIncoming()

    await expect(store.acceptInvitation('inc_gone')).rejects.toMatchObject({ statusCode: 404 })

    expect(store.incoming.map((invitation) => invitation.id)).toEqual(['inc_ok'])
  })

  it('drops a declined invitation', async () => {
    const store = useInvitationsStore()
    await store.fetchIncoming()

    await store.declineInvitation('inc_ok')

    expect(store.incoming.map((invitation) => invitation.id)).toEqual(['inc_gone'])
  })
})
