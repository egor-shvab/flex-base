import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import RoleFormModal from '~/components/modals/RoleFormModal.vue'
import { WORKSPACE_PERMISSIONS } from '#shared/constants/workspace'
import type { IWorkspaceActor, IWorkspaceRole } from '#shared/types/workspace'
import { mountTracked, unmountAll } from '~~/test/mount'

const owner: IWorkspaceActor = {
  memberId: 'mem_owner',
  isOwner: true,
  permissions: [...WORKSPACE_PERMISSIONS],
}

const manager: IWorkspaceActor = {
  memberId: 'mem_manager',
  isOwner: false,
  permissions: ['ROLES_MANAGE', 'RECORDS_CREATE'],
}

const clerk: IWorkspaceRole = {
  id: 'rol_clerk',
  name: 'Clerk',
  permissions: ['RECORDS_CREATE'],
  memberCount: 2,
}

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')!

const checkbox = (label: string) =>
  [...dialog().querySelectorAll('label')]
    .find((element) => element.textContent?.trim() === label)!
    .querySelector<HTMLInputElement>('input')!

async function mountForm(actor: IWorkspaceActor, role?: IWorkspaceRole) {
  const submitHandler = vi.fn().mockResolvedValue(undefined)
  await mountTracked(RoleFormModal, {
    props: { actor, role, submitHandler },
    attachTo: document.body,
  })
  return submitHandler
}

async function submit() {
  dialog().querySelector<HTMLButtonElement>('button[type="submit"]')!.click()
  await nextTick()
}

describe('RoleFormModal', () => {
  afterEach(unmountAll)

  it('offers every permission, checked as the role grants them', async () => {
    await mountForm(owner, clerk)

    expect(dialog().querySelectorAll('input[type="checkbox"]')).toHaveLength(
      WORKSPACE_PERMISSIONS.length,
    )
    expect(checkbox('Add records').checked).toBe(true)
    expect(checkbox('Edit records').checked).toBe(false)
  })

  it('shows a permission the actor lacks, disabled and explained, rather than hiding it', async () => {
    await mountForm(manager)

    const tables = checkbox('Manage tables')
    const hintId = tables.getAttribute('aria-describedby')!

    expect(tables.disabled).toBe(true)
    expect(document.getElementById(hintId)?.textContent).toMatch(/can’t grant it/)
    expect(checkbox('Add records').disabled).toBe(false)
  })

  it('sends the name and the permissions in the editor’s order', async () => {
    const submitHandler = await mountForm(owner, clerk)

    checkbox('Delete records').click()
    checkbox('Rename the workspace').click()
    await nextTick()
    await submit()

    await vi.waitFor(() =>
      expect(submitHandler).toHaveBeenCalledWith({
        name: 'Clerk',
        permissions: ['WORKSPACE_UPDATE', 'RECORDS_CREATE', 'RECORDS_DELETE'],
      }),
    )
  })

  it('refuses the owner’s reserved name before sending anything', async () => {
    const submitHandler = await mountForm(owner)
    const name = dialog().querySelector<HTMLInputElement>('input:not([type="checkbox"])')!

    name.value = 'owner'
    name.dispatchEvent(new Event('input'))
    await nextTick()
    await submit()

    await vi.waitFor(() =>
      expect(dialog().textContent).toContain('is reserved for the workspace owner'),
    )
    expect(submitHandler).not.toHaveBeenCalled()
  })
})
