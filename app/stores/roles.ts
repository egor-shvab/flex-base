import { defineStore } from 'pinia'
import { useRolesApi } from '~/api/roles'
import { useWorkspaceCollection } from '~/composables/useWorkspaceCollection'
import { useWorkspacesStore } from '~/stores/workspaces'
import { isStaleWrite } from '~/utils/api-error'
import type { IRoleDetailResponse } from '#shared/types/api'
import type { IAccessTable, IWorkspaceRole } from '#shared/types/workspace'
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

  /** Held by the page that edits it, not here: only that page reads a role's rows. */
  async function fetchRole(workspaceAddress: string, roleId: string): Promise<IRoleDetailResponse> {
    return api.get(workspaceAddress, roleId)
  }

  /** What a new role's access is set on, for a page that holds no role yet. */
  async function fetchAccessTables(workspaceAddress: string): Promise<IAccessTable[]> {
    return (await api.tables(workspaceAddress)).tables
  }

  async function createRole(
    workspaceAddress: string,
    input: TRoleInput,
  ): Promise<IRoleDetailResponse> {
    const response = await api.create(workspaceAddress, input)
    applyItem(workspaceAddress, response.role)
    return response
  }

  async function updateRole(
    workspaceAddress: string,
    edited: Pick<IWorkspaceRole, 'id' | 'updatedAt'>,
    input: TRoleInput,
  ): Promise<IRoleDetailResponse> {
    let response: IRoleDetailResponse
    try {
      response = await api.update(workspaceAddress, edited.id, input, edited.updatedAt)
    } catch (error) {
      // Refreshed, so the list shows the version that won
      if (isStaleWrite(error)) void fetchRoles(workspaceAddress).catch(() => {})
      throw error
    }
    applyItem(workspaceAddress, response.role)
    await refreshOwnRole(workspaceAddress, edited.id)
    return response
  }

  /** The caller's own role: what they may do, and its name in the switcher, changed with it. */
  async function refreshOwnRole(workspaceAddress: string, roleId: string) {
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
    fetchRole,
    fetchAccessTables,
    createRole,
    updateRole,
    deleteRole,
  }
})
