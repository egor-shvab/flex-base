import { defineWorkspaceHandler } from '#server/utils/handler'
import { routeParam } from '#server/utils/route'
import { MemberService } from '#server/services/members'
import type { IOkResponse } from '#shared/types/api'

export default defineWorkspaceHandler(
  'MEMBERS_MANAGE',
  async ({ event, membership }): Promise<IOkResponse> => {
    await MemberService.removeMember(membership, routeParam(event, 'memberId'))
    return { ok: true }
  },
)
