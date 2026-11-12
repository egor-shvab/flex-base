import { defineStore } from 'pinia'
import { useRolesApi } from '~/api/roles'
import { useWorkspaceCollection } from '~/composables/useWorkspaceCollection'
import { useWorkspacesStore } from '~/stores/workspaces'
import type { IWorkspaceRole } from '#shared/types/workspace'
import type { TRoleInput } from '#shared/validation/workspace'

/** The roles of one workspace at a time: the one last loaded. */
export const useRolesStore = defineStore('roles', () => {
  const api = useRolesApi()
  const workspacesStore = useWorkspacesStore()

  const {
    items: roles,
    loadedWorkspaceAddress,
    fetchItems,
    applyItem,
    removeItem,
  } = useWorkspaceCollection<IWorkspaceRole>()

  async function fetchRoles(workspaceAddress: string) {
    return fetchItems(workspaceAddress, async () => (await api.list(workspaceAddress)).roles)
  }

  async function createRole(workspaceAddress: string, input: TRoleInput) {
    const { role } = await api.create(workspaceAddress, input)
    applyItem(workspaceAddress, role)
  }

  async function updateRole(workspaceAddress: string, roleId: string, input: TRoleInput) {
    const { role } = await api.update(workspaceAddress, roleId, input)
    applyItem(workspaceAddress, role)

    // The caller's own role: what they may do, and its name in the switcher, changed with it
    if (workspacesStore.findMembership(workspaceAddress)?.role.id === roleId) {
      await workspacesStore.fetchMembership(workspaceAddress)
    }
  }

  async function deleteRole(workspaceAddress: string, roleId: string) {
    await api.remove(workspaceAddress, roleId)
    removeItem(workspaceAddress, roleId)
  }

  return {
    roles,
    loadedWorkspaceAddress,
    fetchRoles,
    createRole,
    updateRole,
    deleteRole,
  }
})
