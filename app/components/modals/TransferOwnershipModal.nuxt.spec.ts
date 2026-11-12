import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError } from 'h3'
import { setActivePinia } from 'pinia'
import type { Pinia } from 'pinia'
import { useNuxtApp } from '#imports'
import TransferOwnershipModal from '~/components/modals/TransferOwnershipModal.vue'
import type { IWorkspaceMember } from '#shared/types/workspace'
import { mountTracked, unmountAll } from '~~/test/mount'

const WS = 'k3f9x2m8qa'
const LONELY_WS = 'l0n3lyw0rk'
const BROKEN_WS = 'br0k3nw0rk'

const buildMember = (id: string, name: string, isOwner = false): IWorkspaceMember => ({
  id,
  isOwner,
  user: { id: `usr_${id}`, name },
  email: `${name.toLowerCase()}@example.com`,
  role: { id: 'rol_editor', name: isOwner ? 'Admin' : 'Editor', permissions: [] },
  joinedAt: '2026-02-01T10:00:00.000Z',
})

registerEndpoint(`/api/workspaces/${WS}/members`, () => ({
  members: [buildMember('mem_ada', 'Ada', true), buildMember('mem_grace', 'Grace')],
}))
registerEndpoint(`/api/workspaces/${LONELY_WS}/members`, () => ({
  members: [buildMember('mem_ada', 'Ada', true)],
}))
registerEndpoint(`/api/workspaces/${BROKEN_WS}/members`, () => {
  throw createError({ statusCode: 409, statusMessage: 'Unavailable' })
})

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')!
const submitButton = () => dialog().querySelector<HTMLButtonElement>('button[type="submit"]')

async function mountModal(workspaceAddress: string) {
  const submitHandler = vi.fn().mockResolvedValue(undefined)
  await mountTracked(TransferOwnershipModal, {
    props: { workspaceAddress, ownRoleName: 'Admin', submitHandler },
    attachTo: document.body,
  })
  await vi.waitFor(() => expect(dialog().textContent).not.toContain('Loading members'))
  return submitHandler
}

describe('TransferOwnershipModal', () => {
  beforeEach(() => {
    setActivePinia(useNuxtApp().$pinia as Pinia)
  })

  afterEach(unmountAll)

  it('offers every member but the owner, and says which role the owner keeps', async () => {
    const submitHandler = await mountModal(WS)

    dialog().querySelector<HTMLButtonElement>('.base-select__trigger')!.click()
    await nextTick()
    const options = [...document.querySelectorAll<HTMLElement>('[role="option"]')]
    expect(options.map((option) => option.textContent?.trim())).toEqual(['Grace · Editor'])
    expect(dialog().textContent).toContain('You stay a member as Admin')

    options[0]!.click()
    await nextTick()
    submitButton()!.click()
    await vi.waitFor(() => expect(submitHandler).toHaveBeenCalledWith('mem_grace'))
  })

  it('offers no transfer while nobody else is in the workspace', async () => {
    await mountModal(LONELY_WS)

    expect(dialog().textContent).toContain('There is no one to hand this workspace to yet')
    expect(submitButton()).toBeNull()
  })

  it('says when the members could not be loaded, with a retry', async () => {
    await mountModal(BROKEN_WS)

    expect(dialog().textContent).toContain("Couldn't load the members.")
    expect(dialog().querySelector('button.base-button--link')?.textContent?.trim()).toBe(
      'Try again',
    )
    expect(submitButton()).toBeNull()
  })
})
