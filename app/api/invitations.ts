import { useApi } from '~/api/client'
import { apiPath } from '~/api/paths'
import type {
  IIncomingInvitationsResponse,
  IInvitationResponse,
  IInvitationsResponse,
  IOkResponse,
  IWorkspaceMembershipResponse,
} from '#shared/types/api'
import type { TInvitationInput } from '#shared/validation/workspace'

export function useInvitationsApi() {
  const api = useApi()

  return {
    list: (workspaceAddress: string) =>
      api<IInvitationsResponse>(apiPath.invitations(workspaceAddress)),
    create: (workspaceAddress: string, input: TInvitationInput) =>
      api<IInvitationResponse>(apiPath.invitations(workspaceAddress), {
        method: 'POST',
        body: input,
      }),
    revoke: (workspaceAddress: string, invitationId: string) =>
      api<IOkResponse>(apiPath.invitation(workspaceAddress, invitationId), { method: 'DELETE' }),

    listIncoming: () => api<IIncomingInvitationsResponse>(apiPath.incomingInvitations),
    accept: (invitationId: string) =>
      api<IWorkspaceMembershipResponse>(apiPath.incomingInvitationAccept(invitationId), {
        method: 'POST',
      }),
    decline: (invitationId: string) =>
      api<IOkResponse>(apiPath.incomingInvitation(invitationId), { method: 'DELETE' }),
  }
}
