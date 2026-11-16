import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError } from 'h3'
import { setActivePinia, type Pinia } from 'pinia'
import { clearNuxtData, useNuxtApp } from '#imports'
import RoleAccessPage from '~/pages/w/[workspaceAddress]/settings/roles/[roleId].vue'
import { useWorkspacesStore } from '~/stores/workspaces'
import type { IRoleAccessResponse } from '#shared/types/api'
import { buildMembership, buildRecordDefaults } from '~~/test/membership'
import { mountTracked, unmountAll } from '~~/test/mount'

const WS = 'k3f9x2m8qa'
const ROLE_ID = 'rol_clerk'

mockNuxtImport('useRoute', () => () => ({
  path: `/w/${WS}/settings/roles/${ROLE_ID}`,
  params: { workspaceAddress: WS, roleId: ROLE_ID },
  query: {},
}))

const response = (isWithinCaller = true): IRoleAccessResponse => ({
  role: {
    id: ROLE_ID,
    name: 'Clerk',
    permissions: [],
    recordDefaults: buildRecordDefaults(),
    memberCount: 0,
    isWithinCaller,
    updatedAt: '2026-02-11T16:30:00.000Z',
  },
  overrides: { tables: [], fields: [] },
  tables: [{ id: 'tbl_deals', name: 'Deals', fields: [] }],
})

let roleAccess: IRoleAccessResponse = response()
let shouldFail = false
let ownAccessRequests = 0

registerEndpoint(`/api/workspaces/${WS}/roles/${ROLE_ID}/access`, {
  method: 'GET',
  handler: () => {
    // A 4xx: `ofetch` retries a GET once on 5xx
    if (shouldFail) throw createError({ statusCode: 403, statusMessage: 'Not allowed' })
    return roleAccess
  },
})

registerEndpoint(`/api/workspaces/${WS}/roles/rol_actor/access`, {
  method: 'GET',
  handler: () => {
    ownAccessRequests += 1
    return { ...response(), role: { ...response().role, id: 'rol_actor' } }
  },
})

async function mountPage(isOwner = false) {
  const workspaces = useWorkspacesStore()
  workspaces.memberships = [
    {
      ...buildMembership(['ROLES_MANAGE'], { isOwner }),
      workspace: { ...buildMembership([]).workspace, publicId: WS },
    },
  ]
  const wrapper = await mountTracked(RoleAccessPage, { attachTo: document.body })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(useNuxtApp().$pinia as Pinia)
  clearNuxtData(`role-access-${WS}-${ROLE_ID}`)
  roleAccess = response()
  shouldFail = false
  ownAccessRequests = 0
})

afterEach(unmountAll)

describe('the role access page', () => {
  it('shows the role’s access, reading the caller’s own role to know how far they may grant', async () => {
    const wrapper = await mountPage()

    expect(wrapper.text()).toContain('Access of Clerk')
    expect(wrapper.text()).toContain('Deals')
    expect(wrapper.find('button[type="submit"]').exists()).toBe(true)
    expect(ownAccessRequests).toBe(1)
  })

  it('reads nothing more for the owner, whom no role narrows', async () => {
    await mountPage(true)

    expect(ownAccessRequests).toBe(0)
  })

  it('offers no form for a role that grants more than the caller', async () => {
    roleAccess = response(false)

    const wrapper = await mountPage()

    expect(wrapper.text()).toContain('grants more than yours')
    expect(wrapper.find('button[type="submit"]').exists()).toBe(false)
  })

  it('states a failed load, with a way to try again', async () => {
    shouldFail = true

    const wrapper = await mountPage()

    expect(wrapper.find('[role="alert"]').text()).toContain('Not allowed')
    expect(wrapper.text()).toContain('Try again')
  })
})
