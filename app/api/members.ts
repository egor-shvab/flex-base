import { useApi } from '~/api/client'
import { apiPath } from '~/api/paths'
import type { IMemberResponse, IMembersResponse, IOkResponse } from '#shared/types/api'
import type { TMemberRoleInput } from '#shared/validation/workspace'

export function useMembersApi() {
  const api = useApi()

  return {
    list: (workspaceAddress: string) => api<IMembersResponse>(apiPath.members(workspaceAddress)),
    changeRole: (workspaceAddress: string, memberId: string, input: TMemberRoleInput) =>
      api<IMemberResponse>(apiPath.member(workspaceAddress, memberId), {
        method: 'PATCH',
        body: input,
      }),
    remove: (workspaceAddress: string, memberId: string) =>
      api<IOkResponse>(apiPath.member(workspaceAddress, memberId), { method: 'DELETE' }),
  }
}
