import { defineEventHandler } from 'h3'
import { requireUser } from '#server/utils/auth'
import { InvitationService } from '#server/services/invitations'
import type { IIncomingInvitationsResponse } from '#shared/types/api'

export default defineEventHandler(async (event): Promise<IIncomingInvitationsResponse> => ({
  invitations: await InvitationService.listIncomingInvitations(requireUser(event)),
}))
