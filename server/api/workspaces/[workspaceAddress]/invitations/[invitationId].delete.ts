import { defineWorkspaceHandler } from '#server/utils/handler'
import { routeParam } from '#server/utils/route'
import { InvitationService } from '#server/services/invitations'
import type { IOkResponse } from '#shared/types/api'

export default defineWorkspaceHandler(
  'MEMBERS_INVITE',
  async ({ event, membership }): Promise<IOkResponse> => {
    await InvitationService.revokeInvitation(
      membership.workspace.id,
      routeParam(event, 'invitationId'),
    )
    return { ok: true }
  },
)
