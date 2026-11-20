import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError } from 'h3'
import { setActivePinia } from 'pinia'
import type { Pinia } from 'pinia'
import { useNuxtApp } from '#imports'
import TransferOwnershipModal from '~/components/features/workspace/TransferOwnershipModal.vue'
import type { IWorkspaceMember, IWorkspaceRole } from '#shared/types/workspace'
import { mountTracked, unmountAll } from '~~/test/mount'

const WS = 'k3f9x2m8qa'
const LONELY_WS = 'l0n3lyw0rk'
const BROKEN_WS = 'br0k3nw0rk'

const buildMember = (id: string, name: string, isOwner = false): IWorkspaceMember => ({
  id,
  isOwner,
  user: { id: `usr_${id}`, name },
  email: `${name.toLowerCase()}@example.com`,
  role: {
    id: 'rol_editor',
    name: isOwner ? 'Admin' : 'Editor',
    permissions: [],
  },
  joinedAt: '2026-02-01T10:00:00.000Z',
})

const buildRole = (id: string, name: string): IWorkspaceRole => ({
  id,
  name,
  permissions: [],
  memberCount: 1,
  readableTableCount: 0,
  isWithinCaller: true,
  updatedAt: '2026-02-11T16:30:00.000Z',
})

for (const workspaceAddress of [WS, LONELY_WS]) {
  registerEndpoint(`/api/workspaces/${workspaceAddress}/roles`, () => ({
    roles: [buildRole('rol_admin', 'Admin'), buildRole('rol_viewer', 'Viewer')],
  }))
}

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
    props: { workspaceAddress, ownRoleId: 'rol_admin', submitHandler },
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

  async function pickOption(selectIndex: number, label: string) {
    dialog().querySelectorAll<HTMLButtonElement>('.base-select__trigger')[selectIndex]!.click()
    await nextTick()
    const options = [...document.querySelectorAll<HTMLElement>('[role="option"]')]
    options.find((option) => option.textContent?.trim() === label)!.click()
    await nextTick()
    return options.map((option) => option.textContent?.trim())
  }

  it('offers every member but the owner, and keeps the owner’s role unless told otherwise', async () => {
    const submitHandler = await mountModal(WS)

    expect(await pickOption(0, 'Grace · Editor')).toEqual(['Grace · Editor'])
    expect(dialog().textContent).toContain('Your role after the transfer')

    submitButton()!.click()
    await vi.waitFor(() =>
      expect(submitHandler).toHaveBeenCalledWith({ memberId: 'mem_grace', roleId: 'rol_admin' }),
    )
  })

  it('hands over with the role the owner chose to keep', async () => {
    const submitHandler = await mountModal(WS)

    await pickOption(0, 'Grace · Editor')
    expect(await pickOption(1, 'Viewer')).toEqual(['Admin', 'Viewer'])

    submitButton()!.click()
    await vi.waitFor(() =>
      expect(submitHandler).toHaveBeenCalledWith({ memberId: 'mem_grace', roleId: 'rol_viewer' }),
    )
  })

  it('offers no transfer while nobody else is in the workspace', async () => {
    await mountModal(LONELY_WS)

    expect(dialog().textContent).toContain('There is no one to hand this workspace to yet')
    expect(submitButton()).toBeNull()
  })

  it('says when the members could not be loaded, with a retry', async () => {
    await mountModal(BROKEN_WS)

    expect(dialog().textContent).toContain("Couldn't load the members and roles.")
    expect(dialog().querySelector('button.base-button--link')?.textContent?.trim()).toBe(
      'Try again',
    )
    expect(submitButton()).toBeNull()
  })
})
