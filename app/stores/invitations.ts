import { ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { useInvitationsApi } from '~/api/invitations'
import { useWorkspaceCollection } from '~/composables/useWorkspaceCollection'
import { useAuthStore } from '~/stores/auth'
import { useWorkspacesStore } from '~/stores/workspaces'
import type { TLoadStatus } from '~/types/load-status'
import type { IHttpFailure } from '~/utils/api-error'
import type { IIncomingInvitation, IWorkspaceInvitation } from '#shared/types/workspace'
import type { TInvitationInput } from '#shared/validation/workspace'

/**
 * Both sides of an invitation: those one workspace has sent (`outgoing`, for its inviters), and
 * those waiting for the signed-in user (`incoming`, which the switcher counts).
 */
export const useInvitationsStore = defineStore('invitations', () => {
  const api = useInvitationsApi()
  const auth = useAuthStore()
  const workspacesStore = useWorkspacesStore()

  const {
    items: outgoing,
    loadedWorkspaceAddress,
    fetchItems,
    applyItem,
    removeItem,
  } = useWorkspaceCollection<IWorkspaceInvitation>()

  const incoming = shallowRef<IIncomingInvitation[]>([])
  const incomingStatus = ref<TLoadStatus>('idle')
  // Logging out leaves the app without a reload, so the list must say whose it is
  const incomingUserId = ref<string | null>(null)

  async function fetchInvitations(workspaceAddress: string) {
    return fetchItems(workspaceAddress, async () => (await api.list(workspaceAddress)).invitations)
  }

  /** Sending to an address already invited renews that invitation, so it replaces it. */
  async function createInvitation(workspaceAddress: string, input: TInvitationInput) {
    const { invitation } = await api.create(workspaceAddress, input)
    applyItem(workspaceAddress, invitation)
  }

  async function revokeInvitation(workspaceAddress: string, invitationId: string) {
    await api.revoke(workspaceAddress, invitationId)
    removeItem(workspaceAddress, invitationId)
  }

  async function fetchIncoming() {
    const userId = auth.user?.id ?? null
    if (userId !== incomingUserId.value) incoming.value = []
    incomingUserId.value = userId
    incomingStatus.value = 'loading'

    try {
      incoming.value = (await api.listIncoming()).invitations
      incomingStatus.value = 'ready'
    } catch (error) {
      incomingStatus.value = 'failed'
      throw error
    }
  }

  /** Never throws, like `ensureWorkspaces`: the layout calling it has no error boundary above it. */
  async function ensureIncoming() {
    if (incomingStatus.value === 'ready' && incomingUserId.value === (auth.user?.id ?? null)) return

    try {
      await fetchIncoming()
    } catch {
      // surfaced through `incomingStatus`
    }
  }

  function forgetIncoming(invitationId: string) {
    incoming.value = incoming.value.filter((invitation) => invitation.id !== invitationId)
  }

  /** A 404 means it was revoked, expired or answered elsewhere: it is dropped from the list. */
  async function answerIncoming<T>(invitationId: string, request: () => Promise<T>): Promise<T> {
    try {
      const answer = await request()
      forgetIncoming(invitationId)
      return answer
    } catch (error) {
      if ((error as IHttpFailure | null)?.statusCode === 404) forgetIncoming(invitationId)
      throw error
    }
  }

  async function acceptInvitation(invitationId: string) {
    const { membership } = await answerIncoming(invitationId, () => api.accept(invitationId))
    workspacesStore.applyMembership(membership)
    return membership
  }

  async function declineInvitation(invitationId: string) {
    await answerIncoming(invitationId, () => api.decline(invitationId))
  }

  return {
    outgoing,
    loadedWorkspaceAddress,
    incoming,
    incomingStatus,
    incomingUserId,
    fetchInvitations,
    createInvitation,
    revokeInvitation,
    fetchIncoming,
    ensureIncoming,
    acceptInvitation,
    declineInvitation,
  }
})
