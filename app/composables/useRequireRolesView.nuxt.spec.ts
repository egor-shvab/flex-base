import { beforeEach, describe, expect, it } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { createPinia, setActivePinia } from 'pinia'
import { useRequireRolesView } from '~/composables/useRequireRolesView'
import { useWorkspacesStore } from '~/stores/workspaces'
import type { IWorkspaceMembershipView, TWorkspacePermission } from '#shared/types/workspace'

const WS = 'k3f9x2m8qa'

mockNuxtImport('useRoute', () => () => ({ params: { workspaceAddress: WS }, query: {} }))

function joinWith(permissions: TWorkspacePermission[]) {
  const membership: IWorkspaceMembershipView = {
    memberId: 'mem_1',
    isOwner: false,
    permissions,
    role: null,
    workspace: { id: 'wsp_1', publicId: WS, name: 'Acme', createdAt: '2026-01-01T00:00:00.000Z' },
  }
  useWorkspacesStore().memberships = [membership]
}

describe('useRequireRolesView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('answers a member who may not see roles with the 404 of a page that is not there', () => {
    joinWith(['TABLES_MANAGE'])

    expect(() => useRequireRolesView()).toThrow(expect.objectContaining({ statusCode: 404 }))
  })

  it('lets through whoever may see roles, the permission given or brought by another', () => {
    joinWith(['ROLES_VIEW'])
    expect(() => useRequireRolesView()).not.toThrow()

    joinWith(['MEMBERS_MANAGE'])
    expect(() => useRequireRolesView()).not.toThrow()
  })
})
