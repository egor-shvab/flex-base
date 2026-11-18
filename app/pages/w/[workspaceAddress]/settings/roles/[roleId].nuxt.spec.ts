import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError } from 'h3'
import { setActivePinia, type Pinia } from 'pinia'
import { clearNuxtData, useNuxtApp } from '#imports'
import RolePage from '~/pages/w/[workspaceAddress]/settings/roles/[roleId].vue'
import { useWorkspacesStore } from '~/stores/workspaces'
import type { IRoleDetailResponse } from '#shared/types/api'
import { buildMembership } from '~~/test/membership'
import { mountTracked, unmountAll } from '~~/test/mount'

const WS = 'k3f9x2m8qa'
const ROLE_ID = 'rol_clerk'

mockNuxtImport('useRoute', () => () => ({
  path: `/w/${WS}/settings/roles/${ROLE_ID}`,
  params: { workspaceAddress: WS, roleId: ROLE_ID },
  query: {},
}))

const response = (isWithinCaller = true, memberCount = 0): IRoleDetailResponse => ({
  role: {
    id: ROLE_ID,
    name: 'Clerk',
    permissions: [],
    readableTableCount: 1,
    memberCount,
    isWithinCaller,
    updatedAt: '2026-02-11T16:30:00.000Z',
  },
  overrides: { tables: [], fields: [] },
  tables: [{ id: 'tbl_deals', name: 'Deals', fields: [] }],
})

let roleDetail: IRoleDetailResponse = response()
let shouldFail = false
let ownRoleRequests = 0

registerEndpoint(`/api/workspaces/${WS}/roles/${ROLE_ID}`, {
  method: 'GET',
  handler: () => {
    // A 4xx: `ofetch` retries a GET once on 5xx
    if (shouldFail) throw createError({ statusCode: 403, statusMessage: 'Not allowed' })
    return roleDetail
  },
})

registerEndpoint(`/api/workspaces/${WS}/roles/rol_actor`, {
  method: 'GET',
  handler: () => {
    ownRoleRequests += 1
    return { ...response(), role: { ...response().role, id: 'rol_actor' } }
  },
})

/** `heldRoleId` is the caller's own role: the one this page shows, or another. */
async function mountPage(isOwner = false, heldRoleId = 'rol_actor') {
  const workspaces = useWorkspacesStore()
  workspaces.memberships = [
    {
      ...buildMembership(['ROLES_MANAGE'], { isOwner }),
      role: { id: heldRoleId, name: 'Clerk' },
      workspace: { ...buildMembership([]).workspace, publicId: WS },
    },
  ]
  const wrapper = await mountTracked(RolePage, { attachTo: document.body })
  await flushPromises()
  return wrapper
}

const deleteButton = () =>
  [...document.querySelectorAll('button')].find(
    (element) => element.textContent?.trim() === 'Delete role',
  )

beforeEach(() => {
  setActivePinia(useNuxtApp().$pinia as Pinia)
  clearNuxtData(`role-${WS}-${ROLE_ID}`)
  roleDetail = response()
  shouldFail = false
  ownRoleRequests = 0
})

afterEach(unmountAll)

describe('the role page', () => {
  it('shows the role, reading the caller’s own role to know how far they may grant', async () => {
    const wrapper = await mountPage()

    expect(wrapper.find('h2').text()).toBe('Clerk')
    expect(wrapper.text()).toContain('Deals')
    expect(wrapper.find('input[type="text"]').element).toHaveProperty('value', 'Clerk')
    expect(ownRoleRequests).toBe(1)
  })

  it('reads nothing more for the owner, whom no role narrows', async () => {
    await mountPage(true)

    expect(ownRoleRequests).toBe(0)
  })

  it('offers no form for a role that grants more than the caller', async () => {
    roleDetail = response(false)

    const wrapper = await mountPage()

    expect(wrapper.text()).toContain('grants more than yours')
    expect(wrapper.find('form').exists()).toBe(false)
  })

  it('offers no form for the role the caller holds, which only the owner changes', async () => {
    const wrapper = await mountPage(false, ROLE_ID)

    expect(wrapper.text()).toContain('only the workspace owner can change it')
    expect(wrapper.find('form').exists()).toBe(false)
  })

  it('lets the owner change the role they hold, saying when it binds them', async () => {
    const wrapper = await mountPage(true, ROLE_ID)

    expect(wrapper.text()).toContain('it applies to you once you hand the workspace over')
    expect(wrapper.find('form').exists()).toBe(true)
  })

  it('offers deleting a role nobody holds, and explains why one held cannot be', async () => {
    await mountPage()
    expect(deleteButton()).toBeDefined()

    unmountAll()
    clearNuxtData(`role-${WS}-${ROLE_ID}`)
    roleDetail = response(true, 2)
    const wrapper = await mountPage()

    expect(deleteButton()).toBeUndefined()
    expect(wrapper.text()).toContain('2 members have this role')
  })

  it('states a failed load, with a way to try again', async () => {
    shouldFail = true

    const wrapper = await mountPage()

    expect(wrapper.find('[role="alert"]').text()).toContain('Not allowed')
    expect(wrapper.text()).toContain('Try again')
  })
})
