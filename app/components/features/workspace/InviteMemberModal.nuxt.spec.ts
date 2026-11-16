import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import InviteMemberModal from '~/components/features/workspace/InviteMemberModal.vue'
import { WORKSPACE_PERMISSIONS } from '#shared/constants/workspace'
import type { IWorkspaceRole } from '#shared/types/workspace'
import { mountTracked, unmountAll } from '~~/test/mount'
import { buildRecordDefaults } from '~~/test/membership'

const ROLES: IWorkspaceRole[] = [
  {
    id: 'rol_admin',
    name: 'Admin',
    permissions: [...WORKSPACE_PERMISSIONS],
    recordDefaults: buildRecordDefaults({
      canCreate: true,
      updateScope: 'ALL',
      deleteScope: 'ALL',
    }),
    memberCount: 1,
    isWithinCaller: false,
    updatedAt: '2026-02-11T16:30:00.000Z',
  },
  {
    id: 'rol_editor',
    name: 'Editor',
    permissions: [],
    recordDefaults: buildRecordDefaults({ canCreate: true, updateScope: 'ALL' }),
    memberCount: 0,
    isWithinCaller: true,
    updatedAt: '2026-02-11T16:30:00.000Z',
  },
  {
    id: 'rol_viewer',
    name: 'Viewer',
    permissions: [],
    recordDefaults: buildRecordDefaults(),
    memberCount: 0,
    isWithinCaller: true,
    updatedAt: '2026-02-11T16:30:00.000Z',
  },
]

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')!
const roleValue = () => dialog().querySelector('.base-select__value')?.textContent?.trim()

async function mountModal() {
  const submitHandler = vi.fn().mockResolvedValue(undefined)
  const wrapper = await mountTracked(InviteMemberModal, {
    props: { roles: ROLES, submitHandler },
    attachTo: document.body,
  })
  return { wrapper, submitHandler }
}

async function typeEmail(value: string) {
  const email = dialog().querySelector<HTMLInputElement>('input[type="email"]')!
  email.value = value
  email.dispatchEvent(new Event('input'))
  await nextTick()
}

async function submit() {
  dialog().querySelector<HTMLButtonElement>('button[type="submit"]')!.click()
  await nextTick()
}

async function openRoles() {
  dialog().querySelector<HTMLButtonElement>('.base-select__trigger')!.click()
  await nextTick()
  return [...document.querySelectorAll('[role="option"]')].map((option) =>
    option.textContent?.trim(),
  )
}

describe('InviteMemberModal', () => {
  afterEach(unmountAll)

  it('offers only the roles the inviter may hand out, starting from the narrowest', async () => {
    await mountModal()

    expect(roleValue()).toBe('Viewer')
    expect(await openRoles()).toEqual(['Editor', 'Viewer'])
  })

  it('sends the email lowercased with the chosen role', async () => {
    const { submitHandler } = await mountModal()
    await typeEmail('  Grace@Example.com ')

    await submit()
    await vi.waitFor(() => expect(submitHandler).toHaveBeenCalled())

    expect(submitHandler).toHaveBeenCalledWith({
      email: 'grace@example.com',
      roleId: 'rol_viewer',
    })
  })

  it('refuses an address that is not one, without sending', async () => {
    const { submitHandler } = await mountModal()
    await typeEmail('grace')

    await submit()

    await vi.waitFor(() => expect(dialog().textContent).toContain('Enter a valid email address'))
    expect(submitHandler).not.toHaveBeenCalled()
  })
})
