import { defineEventHandler } from 'h3'
import { requireUser } from '#server/utils/auth'
import { routeParam } from '#server/utils/route'
import { InvitationService } from '#server/services/invitations'
import type { IOkResponse } from '#shared/types/api'

export default defineEventHandler(async (event): Promise<IOkResponse> => {
  await InvitationService.declineInvitation(requireUser(event), routeParam(event, 'invitationId'))
  return { ok: true }
})
