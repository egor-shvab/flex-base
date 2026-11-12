import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mockNuxtImport, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError } from 'h3'
import { setActivePinia } from 'pinia'
import type { Pinia } from 'pinia'
import { useNuxtApp } from '#imports'
import IncomingInvitationList from '~/components/invitations/IncomingInvitationList.vue'
import { useInvitationsStore } from '~/stores/invitations'
import { useWorkspacesStore } from '~/stores/workspaces'
import type { IIncomingInvitation, IWorkspaceMembership } from '#shared/types/workspace'
import { mountTracked, unmountAll } from '~~/test/mount'

const JOINED_WS = 'j0in3dw0rk'

const navigations = vi.hoisted(() => [] as unknown[])

mockNuxtImport('navigateTo', () => (to: unknown) => {
  navigations.push(to)
})
mockNuxtImport('useRoute', () => () => ({ params: {}, query: {} }))

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
  permissions: [],
  role: { id: 'rol_editor', name: 'Editor' },
  workspace: { id: 'wsp_j', publicId: JOINED_WS, name: 'Acme', createdAt: '2026-01-01T00:00:00Z' },
}

registerEndpoint('/api/invitations/inv_acme/accept', {
  method: 'POST',
  handler: () => ({ membership: joined }),
})

registerEndpoint('/api/invitations/inv_gone/accept', {
  method: 'POST',
  handler: () => {
    throw createError({ statusCode: 404, statusMessage: 'This invitation is no longer valid' })
  },
})

const button = (name: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent?.replace(/\s+/g, ' ').trim() === name,
  )

async function mountList(invitations: IIncomingInvitation[]) {
  const store = useInvitationsStore()
  store.incoming = invitations
  store.incomingStatus = 'ready'
  await mountTracked(IncomingInvitationList, { attachTo: document.body })
}

describe('IncomingInvitationList', () => {
  beforeEach(() => {
    setActivePinia(useNuxtApp().$pinia as Pinia)
    navigations.length = 0
  })

  afterEach(() => {
    unmountAll()
    useInvitationsStore().incoming = []
    useWorkspacesStore().memberships = []
  })

  it('names who invited the caller, to what, and as which role', async () => {
    await mountList([buildIncoming('inv_acme', 'Acme')])

    expect(document.body.textContent).toContain('Acme')
    expect(document.body.textContent).toContain('Ada invited you as Editor')
    expect(button('Accept the invitation to Acme')).toBeDefined()
    expect(button('Decline the invitation to Acme')).toBeDefined()
  })

  it('opens the workspace once accepted', async () => {
    await mountList([buildIncoming('inv_acme', 'Acme')])

    button('Accept the invitation to Acme')!.click()

    await vi.waitFor(() => expect(navigations).toEqual([`/w/${JOINED_WS}`]))
    expect(useWorkspacesStore().findMembership(JOINED_WS)).toBeDefined()
  })

  it('says when an invitation is no longer valid, and drops it', async () => {
    await mountList([buildIncoming('inv_gone', 'Gone'), buildIncoming('inv_acme', 'Acme')])

    button('Accept the invitation to Gone')!.click()

    await vi.waitFor(() =>
      expect(document.querySelector('[role="alert"]')?.textContent).toContain(
        'This invitation is no longer valid',
      ),
    )
    await nextTick()
    expect(button('Accept the invitation to Gone')).toBeUndefined()
    expect(navigations).toEqual([])
  })

  it('says so when nothing is waiting', async () => {
    await mountList([])

    expect(document.body.textContent).toContain('No invitations are waiting for you.')
  })
})
