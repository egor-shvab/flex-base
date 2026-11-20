import { defineWorkspaceHandler } from '#server/utils/handler'
import { InvitationService } from '#server/services/invitations'
import type { IInvitationsResponse } from '#shared/types/api'

export default defineWorkspaceHandler(
  'MEMBERS_INVITE',
  async ({ membership }): Promise<IInvitationsResponse> => ({
    invitations: await InvitationService.listInvitations(membership.workspace.id),
  }),
)
