import { defineWorkspaceHandler } from '#server/utils/handler'
import { MemberService } from '#server/services/members'
import type { IMembersResponse } from '#shared/types/api'

export default defineWorkspaceHandler(
  'READ',
  async ({ membership }): Promise<IMembersResponse> => ({
    members: await MemberService.listMembers(membership.workspace.id),
  }),
)
