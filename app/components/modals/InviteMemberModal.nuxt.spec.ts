import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import InviteMemberModal from '~/components/modals/InviteMemberModal.vue'
import { WORKSPACE_PERMISSIONS } from '#shared/constants/workspace'
import type { IWorkspaceActor, IWorkspaceRole } from '#shared/types/workspace'
import { mountTracked, unmountAll } from '~~/test/mount'

const ROLES: IWorkspaceRole[] = [
  { id: 'rol_admin', name: 'Admin', permissions: [...WORKSPACE_PERMISSIONS], memberCount: 1 },
  {
    id: 'rol_editor',
    name: 'Editor',
    permissions: ['RECORDS_CREATE', 'RECORDS_UPDATE'],
    memberCount: 0,
  },
  { id: 'rol_viewer', name: 'Viewer', permissions: [], memberCount: 0 },
]

const inviter: IWorkspaceActor = {
  memberId: 'mem_1',
  isOwner: false,
  permissions: ['MEMBERS_INVITE', 'RECORDS_CREATE', 'RECORDS_UPDATE'],
}

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')!
const roleValue = () => dialog().querySelector('.base-select__value')?.textContent?.trim()

async function mountModal() {
  const submitHandler = vi.fn().mockResolvedValue(undefined)
  const wrapper = await mountTracked(InviteMemberModal, {
    props: { actor: inviter, roles: ROLES, submitHandler },
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
