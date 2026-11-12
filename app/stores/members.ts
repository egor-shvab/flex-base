import { defineStore } from 'pinia'
import { useMembersApi } from '~/api/members'
import { useWorkspaceCollection } from '~/composables/useWorkspaceCollection'
import type { IWorkspaceMember } from '#shared/types/workspace'

/** The members of one workspace at a time: the one last loaded. */
export const useMembersStore = defineStore('members', () => {
  const api = useMembersApi()

  const {
    items: members,
    loadedWorkspaceAddress,
    fetchItems,
    applyItem,
    removeItem,
  } = useWorkspaceCollection<IWorkspaceMember>()

  async function fetchMembers(workspaceAddress: string) {
    return fetchItems(workspaceAddress, async () => (await api.list(workspaceAddress)).members)
  }

  async function changeMemberRole(workspaceAddress: string, memberId: string, roleId: string) {
    const { member } = await api.changeRole(workspaceAddress, memberId, { roleId })
    applyItem(workspaceAddress, member)
  }

  async function removeMember(workspaceAddress: string, memberId: string) {
    await api.remove(workspaceAddress, memberId)
    removeItem(workspaceAddress, memberId)
  }

  return {
    members,
    loadedWorkspaceAddress,
    fetchMembers,
    changeMemberRole,
    removeMember,
  }
})
