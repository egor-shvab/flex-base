import { readValidatedBody } from 'h3'
import { defineWorkspaceHandler } from '#server/utils/handler'
import { assertWithinRateLimit, createRateLimiter } from '#server/utils/rate-limit'
import { InvitationService } from '#server/services/invitations'
import { invitationInputSchema } from '#shared/validation/workspace'
import type { IInvitationResponse } from '#shared/types/api'

/** Per inviter across every workspace, so many workspaces do not multiply the allowance. */
const limiter = createRateLimiter({ limit: 30, windowMs: 60 * 60 * 1000, maxKeys: 5_000 })

export default defineWorkspaceHandler(
  'MEMBERS_INVITE',
  async ({ event, user, membership }): Promise<IInvitationResponse> => {
    const input = await readValidatedBody(event, invitationInputSchema.parse)

    assertWithinRateLimit(limiter, user.id, 'Too many invitations sent. Try again in an hour')

    const invitation = await InvitationService.createInvitation(membership, user.id, input)
    return { invitation }
  },
)
