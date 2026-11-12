import { readValidatedBody } from 'h3'
import { defineWorkspaceHandler } from '#server/utils/handler'
import { routeParam } from '#server/utils/route'
import { MemberService } from '#server/services/members'
import { memberRoleInputSchema } from '#shared/validation/workspace'
import type { IMemberResponse } from '#shared/types/api'

export default defineWorkspaceHandler(
  'MEMBERS_MANAGE',
  async ({ event, membership }): Promise<IMemberResponse> => {
    const { roleId } = await readValidatedBody(event, memberRoleInputSchema.parse)
    const member = await MemberService.changeMemberRole(
      membership,
      routeParam(event, 'memberId'),
      roleId,
    )
    return { member }
  },
)
