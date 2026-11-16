import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { createPinia, setActivePinia } from 'pinia'
import { useActiveWorkspace } from '~/composables/useActiveWorkspace'
import { useWorkspacesStore } from '~/stores/workspaces'
import type { IWorkspaceMembership } from '#shared/types/workspace'
import { buildRecordDefaults } from '~~/test/membership'

const WS = 'k3f9x2m8qa'

const routeParams = vi.hoisted(() => ({ value: {} as Record<string, string> }))

mockNuxtImport('useRoute', () => () => ({ params: routeParams.value, query: {} }))

function buildMembership(overrides: Partial<IWorkspaceMembership> = {}): IWorkspaceMembership {
  return {
    memberId: 'mem_1',
    isOwner: false,
    permissions: ['MEMBERS_INVITE'],
    recordDefaults: buildRecordDefaults({ canCreate: true }),
    role: { id: 'rol_1', name: 'Clerk' },
    workspace: { id: 'wsp_1', publicId: WS, name: 'Acme', createdAt: '2026-01-01T00:00:00.000Z' },
    ...overrides,
  }
}

describe('useActiveWorkspace', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    routeParams.value = { workspaceAddress: WS }
  })

  it('answers from the membership of the workspace in the address', () => {
    useWorkspacesStore().memberships = [buildMembership()]
    const { membership, isOwner, hasPermission } = useActiveWorkspace()

    expect(membership.value?.role.name).toBe('Clerk')
    expect(isOwner.value).toBe(false)
    expect(hasPermission('MEMBERS_INVITE')).toBe(true)
    expect(hasPermission('TABLES_MANAGE')).toBe(false)
  })

  it('answers record actions from the role’s record defaults', () => {
    useWorkspacesStore().memberships = [buildMembership()]
    const { hasRecordAction } = useActiveWorkspace()

    expect(hasRecordAction('create')).toBe(true)
    expect(hasRecordAction('update')).toBe(false)
    expect(hasRecordAction('delete')).toBe(false)
  })

  it('grants the owner everything', () => {
    useWorkspacesStore().memberships = [buildMembership({ isOwner: true, permissions: [] })]
    const { isOwner, hasPermission } = useActiveWorkspace()

    expect(isOwner.value).toBe(true)
    expect(hasPermission('ROLES_MANAGE')).toBe(true)
  })

  it('allows nothing while the membership is unknown, or outside a workspace', () => {
    expect(useActiveWorkspace().hasPermission('MEMBERS_INVITE')).toBe(false)
    expect(useActiveWorkspace().hasRecordAction('create')).toBe(false)

    routeParams.value = {}
    useWorkspacesStore().memberships = [buildMembership()]
    const outside = useActiveWorkspace()

    expect(outside.workspaceAddress.value).toBe('')
    expect(outside.hasPermission('MEMBERS_INVITE')).toBe(false)
    expect(outside.hasRecordAction('create')).toBe(false)
  })

  it('follows the store, so a refetched role hides what it no longer grants', () => {
    const store = useWorkspacesStore()
    store.memberships = [buildMembership()]
    const { hasPermission, hasRecordAction } = useActiveWorkspace()

    store.memberships = [
      buildMembership({ permissions: [], recordDefaults: buildRecordDefaults() }),
    ]

    expect(hasPermission('MEMBERS_INVITE')).toBe(false)
    expect(hasRecordAction('create')).toBe(false)
  })
})
