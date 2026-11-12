import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError } from 'h3'
import { createPinia, setActivePinia } from 'pinia'
import { useAccessResync } from '~/composables/useAccessResync'
import { useWorkspacesStore } from '~/stores/workspaces'
import type { IWorkspaceMembership } from '#shared/types/workspace'

const WS = 'k3f9x2m8qa'
const OTHER_WS = 'p7q2w9e4rt'

const routeParams = vi.hoisted(() => ({ value: {} as Record<string, string> }))
const shownErrors = vi.hoisted(() => [] as unknown[])

mockNuxtImport('useRoute', () => () => ({ params: routeParams.value, query: {} }))
mockNuxtImport('showError', () => (error: unknown) => {
  shownErrors.push(error)
})

function buildMembership(publicId: string, permissions: IWorkspaceMembership['permissions']) {
  return {
    memberId: `mem_${publicId}`,
    isOwner: false,
    permissions,
    role: { id: 'rol_1', name: 'Clerk' },
    workspace: { id: `wsp_${publicId}`, publicId, name: 'Acme', createdAt: '2026-01-01T00:00:00Z' },
  } satisfies IWorkspaceMembership
}

let membershipAnswer: 'narrowed' | 'gone' = 'narrowed'
let membershipRequests = 0

registerEndpoint(`/api/workspaces/${WS}`, {
  method: 'GET',
  handler: () => {
    membershipRequests += 1
    if (membershipAnswer === 'gone') throw lostWorkspace()
    return { membership: buildMembership(WS, []) }
  },
})

function lostWorkspace() {
  return createError({
    statusCode: 404,
    statusMessage: 'Workspace not found',
    data: { missing: 'workspace' },
  })
}

/** The shape `ofetch` rejects with: the status, and the server's body as `data`. */
function fetchFailure(statusCode: number, body: Record<string, unknown> = {}) {
  return { statusCode, data: { statusCode, ...body } }
}

describe('useAccessResync', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    routeParams.value = { workspaceAddress: WS }
    useWorkspacesStore().memberships = [
      buildMembership(WS, ['RECORDS_CREATE']),
      buildMembership(OTHER_WS, []),
    ]
    membershipAnswer = 'narrowed'
    membershipRequests = 0
    shownErrors.length = 0
  })

  it('refetches the membership after a 403, so the narrowed role hides its controls', async () => {
    await useAccessResync().resyncAccess(fetchFailure(403))

    expect(membershipRequests).toBe(1)
    expect(useWorkspacesStore().findMembership(WS)?.permissions).toEqual([])
    expect(shownErrors).toEqual([])
  })

  it('forgets a workspace the caller lost and shows its error page, without asking again', async () => {
    await useAccessResync().resyncAccess(
      fetchFailure(404, { statusMessage: 'Workspace not found', data: { missing: 'workspace' } }),
    )

    expect(membershipRequests).toBe(0)
    expect(useWorkspacesStore().findMembership(WS)).toBeUndefined()
    expect(useWorkspacesStore().findMembership(OTHER_WS)).toBeDefined()
    expect(shownErrors).toEqual([
      expect.objectContaining({
        statusCode: 404,
        statusMessage: 'We couldn’t find that workspace.',
      }),
    ])
  })

  it('treats a 403 whose refetch finds the workspace gone as the loss it is', async () => {
    membershipAnswer = 'gone'

    await useAccessResync().resyncAccess(fetchFailure(403))

    expect(useWorkspacesStore().findMembership(WS)).toBeUndefined()
    expect(shownErrors).toHaveLength(1)
  })

  it('leaves everything alone for any other failure, or outside a workspace', async () => {
    await useAccessResync().resyncAccess(fetchFailure(404, { statusMessage: 'Table not found' }))
    await useAccessResync().resyncAccess(fetchFailure(409))
    routeParams.value = {}
    await useAccessResync().resyncAccess(fetchFailure(403))

    expect(membershipRequests).toBe(0)
    expect(useWorkspacesStore().memberships).toHaveLength(2)
    expect(shownErrors).toEqual([])
  })

  it('makes a loader’s failure fatal, having forgotten a lost workspace', () => {
    const { throwPageError } = useAccessResync()

    expect(() =>
      throwPageError(fetchFailure(404, { data: { missing: 'workspace' } })),
    ).toThrowError(expect.objectContaining({ statusCode: 404, fatal: true }))
    expect(useWorkspacesStore().findMembership(WS)).toBeUndefined()
  })
})
