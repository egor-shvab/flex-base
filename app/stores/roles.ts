import { ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { useRolesApi } from '~/api/roles'
import { useWorkspacesStore } from '~/stores/workspaces'
import type { IWorkspaceRole } from '#shared/types/workspace'
import type { TRoleInput } from '#shared/validation/workspace'

/** The roles of one workspace at a time: the one last loaded. */
export const useRolesStore = defineStore('roles', () => {
  const api = useRolesApi()
  const workspacesStore = useWorkspacesStore()

  const roles = shallowRef<IWorkspaceRole[]>([])

  const loadedWorkspaceAddress = ref('')

  /** An answer for a workspace switched away from belongs to a list no longer held. */
  function isLoadedWorkspace(workspaceAddress: string): boolean {
    return workspaceAddress === loadedWorkspaceAddress.value
  }

  async function fetchRoles(workspaceAddress: string) {
    if (!isLoadedWorkspace(workspaceAddress)) roles.value = []
    loadedWorkspaceAddress.value = workspaceAddress

    const response = await api.list(workspaceAddress)
    if (isLoadedWorkspace(workspaceAddress)) roles.value = response.roles
    return response.roles
  }

  function applyRole(next: IWorkspaceRole) {
    roles.value = roles.value.map((role) => (role.id === next.id ? next : role))
  }

  async function createRole(workspaceAddress: string, input: TRoleInput) {
    const { role } = await api.create(workspaceAddress, input)
    if (isLoadedWorkspace(workspaceAddress)) roles.value = [...roles.value, role]
  }

  async function updateRole(workspaceAddress: string, roleId: string, input: TRoleInput) {
    const { role } = await api.update(workspaceAddress, roleId, input)
    if (isLoadedWorkspace(workspaceAddress)) applyRole(role)

    // The caller's own role: what they may do, and its name in the switcher, changed with it
    if (workspacesStore.findMembership(workspaceAddress)?.role.id === roleId) {
      await workspacesStore.fetchMembership(workspaceAddress)
    }
  }

  async function deleteRole(workspaceAddress: string, roleId: string) {
    await api.remove(workspaceAddress, roleId)
    if (isLoadedWorkspace(workspaceAddress)) {
      roles.value = roles.value.filter((role) => role.id !== roleId)
    }
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
