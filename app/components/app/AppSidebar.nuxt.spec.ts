import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mockNuxtImport, registerEndpoint } from '@nuxt/test-utils/runtime'
import { setActivePinia } from 'pinia'
import type { Pinia } from 'pinia'
import { useNuxtApp } from '#imports'
import AppSidebar from '~/components/app/AppSidebar.vue'
import { useWorkspacesStore } from '~/stores/workspaces'
import type { IWorkspaceMembership, TWorkspacePermission } from '#shared/types/workspace'
import { mountTracked, unmountAll } from '~~/test/mount'

const WS = 'k3f9x2m8qa'

mockNuxtImport('useRoute', () => () => ({
  path: `/w/${WS}`,
  params: { workspaceAddress: WS },
  query: {},
}))

registerEndpoint(`/api/workspaces/${WS}/tables`, () => ({ tables: [] }))

function joinAs(permissions: TWorkspacePermission[]) {
  const membership: IWorkspaceMembership = {
    memberId: 'mem_1',
    isOwner: false,
    permissions,
    role: { id: 'rol_1', name: 'Clerk' },
    workspace: { id: 'wsp_1', publicId: WS, name: 'Acme', createdAt: '2026-01-01T00:00:00Z' },
  }
  useWorkspacesStore().memberships = [membership]
}

async function isAddTableOffered(): Promise<boolean> {
  const wrapper = await mountTracked(AppSidebar)
  return wrapper.findAll('button').some((button) => button.text() === 'Add a table')
}

describe('AppSidebar', () => {
  beforeEach(() => {
    setActivePinia(useNuxtApp().$pinia as Pinia)
  })

  afterEach(unmountAll)

  it('offers a new table to a member who manages tables', async () => {
    joinAs(['TABLES_MANAGE'])

    expect(await isAddTableOffered()).toBe(true)
  })

  it('offers none to a member who may only work with records', async () => {
    joinAs(['RECORDS_CREATE', 'RECORDS_UPDATE', 'RECORDS_DELETE'])

    expect(await isAddTableOffered()).toBe(false)
  })
})
