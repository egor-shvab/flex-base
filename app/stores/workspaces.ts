import { ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { useWorkspacesApi } from '~/api/workspaces'
import { useAuthStore } from '~/stores/auth'
import type { TLoadStatus } from '~/types/load-status'
import type { IWorkspaceMembership } from '#shared/types/workspace'
import type { TWorkspaceInput } from '#shared/validation/workspace'

/** The signed-in user's memberships: what the switcher lists and `/` chooses from. */
export const useWorkspacesStore = defineStore('workspaces', () => {
  const api = useWorkspacesApi()
  const auth = useAuthStore()

  const memberships = shallowRef<IWorkspaceMembership[]>([])
  const lastWorkspaceAddress = ref<string | null>(null)
  const status = ref<TLoadStatus>('idle')

  // Logging out leaves the app without a reload, so the list must say whose it is
  const loadedUserId = ref<string | null>(null)

  async function fetchWorkspaces() {
    const userId = auth.user?.id ?? null
    // Emptied first, or the switcher shows the previous user's workspaces until the answer lands
    if (userId !== loadedUserId.value) memberships.value = []
    loadedUserId.value = userId
    status.value = 'loading'

    try {
      const response = await api.list()
      memberships.value = response.memberships
      lastWorkspaceAddress.value = response.lastWorkspaceAddress
      status.value = 'ready'
    } catch (error) {
      status.value = 'failed'
      throw error
    }
  }

  /** Never throws, like `ensureTables`: the layout calling it has no error boundary above it. */
  async function ensureWorkspaces() {
    if (status.value === 'ready' && loadedUserId.value === (auth.user?.id ?? null)) return

    try {
      await fetchWorkspaces()
    } catch {
      // surfaced through `status`
    }
  }

  function findMembership(workspaceAddress: string): IWorkspaceMembership | undefined {
    return memberships.value.find(
      (membership) => membership.workspace.publicId === workspaceAddress,
    )
  }

  function applyMembership(next: IWorkspaceMembership) {
    memberships.value = findMembership(next.workspace.publicId)
      ? memberships.value.map((membership) =>
          membership.workspace.id === next.workspace.id ? next : membership,
        )
      : [...memberships.value, next]
  }

  /** Throws: the workspace page turns a failure into its 404. */
  async function fetchMembership(workspaceAddress: string) {
    const { membership } = await api.get(workspaceAddress)
    applyMembership(membership)
    return membership
  }

  async function createWorkspace(input: TWorkspaceInput) {
    const { membership } = await api.create(input)
    applyMembership(membership)
    return membership
  }

  async function renameWorkspace(workspaceAddress: string, input: TWorkspaceInput) {
    const { workspace } = await api.rename(workspaceAddress, input)
    const membership = findMembership(workspaceAddress)
    if (membership) applyMembership({ ...membership, workspace })
  }

  async function deleteWorkspace(workspaceAddress: string) {
    await api.remove(workspaceAddress)
    memberships.value = memberships.value.filter(
      (membership) => membership.workspace.publicId !== workspaceAddress,
    )
    if (lastWorkspaceAddress.value === workspaceAddress) lastWorkspaceAddress.value = null
  }

  /** Held here too, so `/` reached later in this visit opens it without asking the server. */
  async function rememberLastWorkspace(workspaceAddress: string) {
    lastWorkspaceAddress.value = workspaceAddress
    await api.rememberLast(workspaceAddress)
  }

  return {
    memberships,
    lastWorkspaceAddress,
    status,
    loadedUserId,
    fetchWorkspaces,
    ensureWorkspaces,
    findMembership,
    fetchMembership,
    createWorkspace,
    renameWorkspace,
    deleteWorkspace,
    rememberLastWorkspace,
  }
})
