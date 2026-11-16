import { defineStore } from 'pinia'
import { useRolesApi } from '~/api/roles'
import { useWorkspaceCollection } from '~/composables/useWorkspaceCollection'
import { useWorkspacesStore } from '~/stores/workspaces'
import { isStaleWrite } from '~/utils/api-error'
import type { IRoleAccessResponse } from '#shared/types/api'
import type { IWorkspaceRole } from '#shared/types/workspace'
import type { TRoleAccessInput } from '#shared/validation/role-access'
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

  async function updateRole(
    workspaceAddress: string,
    edited: Pick<IWorkspaceRole, 'id' | 'updatedAt'>,
    input: TRoleInput,
  ) {
    let role: IWorkspaceRole
    try {
      ;({ role } = await api.update(workspaceAddress, edited.id, input, edited.updatedAt))
    } catch (error) {
      // Refreshed, so reopening the role shows the version that won
      if (isStaleWrite(error)) void fetchRoles(workspaceAddress).catch(() => {})
      throw error
    }
    applyItem(workspaceAddress, role)
    await refreshOwnRole(workspaceAddress, edited.id)
  }

  /** The caller's own role: what they may do, and its name in the switcher, changed with it. */
  async function refreshOwnRole(workspaceAddress: string, roleId: string) {
    if (workspacesStore.findMembership(workspaceAddress)?.role.id === roleId) {
      await workspacesStore.fetchMembership(workspaceAddress)
    }
  }

  /** Held by the page that edits it, not here: only that page reads a role's rows. */
  async function fetchRoleAccess(
    workspaceAddress: string,
    roleId: string,
  ): Promise<IRoleAccessResponse> {
    return api.access(workspaceAddress, roleId)
  }

  async function saveRoleAccess(
    workspaceAddress: string,
    edited: Pick<IWorkspaceRole, 'id' | 'updatedAt'>,
    input: TRoleAccessInput,
  ): Promise<IRoleAccessResponse> {
    const response = await api.updateAccess(workspaceAddress, edited.id, input, edited.updatedAt)
    applyItem(workspaceAddress, response.role)
    await refreshOwnRole(workspaceAddress, edited.id)
    return response
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
    fetchRoleAccess,
    saveRoleAccess,
  }
})
