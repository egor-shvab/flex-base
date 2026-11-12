import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError } from 'h3'
import { clearNuxtData } from '#imports'
import type { IWorkspacesResponse } from '#shared/types/api'
import WorkspaceEntry from '~/pages/index.vue'
import { mountTracked } from '~~/test/mount'

const navigateTo = vi.hoisted(() => vi.fn())
mockNuxtImport('navigateTo', () => navigateTo)

const WS = 'k3f9x2m8qa'

const membershipOf = (publicId: string): IWorkspacesResponse['memberships'][number] => ({
  memberId: `mem_${publicId}`,
  isOwner: true,
  permissions: [],
  role: { id: 'rol_1', name: 'Admin' },
  workspace: { id: `wsp_${publicId}`, publicId, name: 'Personal workspace', createdAt: '' },
})

let response: IWorkspacesResponse = { memberships: [], lastWorkspaceAddress: null }
let shouldFail = false

registerEndpoint('/api/workspaces', {
  method: 'GET',
  handler: () => {
    // A 4xx: `ofetch` retries a GET once on 5xx
    if (shouldFail) throw createError({ statusCode: 409, statusMessage: 'Unavailable' })
    return response
  },
})

beforeEach(() => {
  clearNuxtData('workspace-entry')
  navigateTo.mockReset()
  response = { memberships: [], lastWorkspaceAddress: null }
  shouldFail = false
})

describe('the entry page', () => {
  it('opens the last workspace, replacing itself in history', async () => {
    response = {
      memberships: [membershipOf('aaaaaaaaaa'), membershipOf(WS)],
      lastWorkspaceAddress: WS,
    }

    await mountTracked(WorkspaceEntry)

    expect(navigateTo).toHaveBeenCalledWith(`/w/${WS}`, { replace: true })
  })

  it('falls back to the first workspace when none is remembered', async () => {
    response = { memberships: [membershipOf(WS)], lastWorkspaceAddress: null }

    await mountTracked(WorkspaceEntry)

    expect(navigateTo).toHaveBeenCalledWith(`/w/${WS}`, { replace: true })
  })

  it('says so when the user is in no workspace', async () => {
    const wrapper = await mountTracked(WorkspaceEntry)

    expect(wrapper.text()).toContain("You're not in any workspace")
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('tells a failed load from an empty one, and retries into the workspace', async () => {
    shouldFail = true
    const wrapper = await mountTracked(WorkspaceEntry)

    expect(wrapper.get('[role="alert"]').text()).toContain("Couldn't load your workspaces.")
    expect(wrapper.text()).not.toContain("You're not in any workspace")

    shouldFail = false
    response = { memberships: [membershipOf(WS)], lastWorkspaceAddress: null }
    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(navigateTo).toHaveBeenCalledWith(`/w/${WS}`, { replace: true })
  })
})
