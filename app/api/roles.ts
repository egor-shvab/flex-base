import { useApi } from '~/api/client'
import { apiPath } from '~/api/paths'
import type { IOkResponse, IRoleResponse, IRolesResponse } from '#shared/types/api'
import type { TRoleInput } from '#shared/validation/workspace'

export function useRolesApi() {
  const api = useApi()

  return {
    list: (workspaceAddress: string) => api<IRolesResponse>(apiPath.roles(workspaceAddress)),
    create: (workspaceAddress: string, input: TRoleInput) =>
      api<IRoleResponse>(apiPath.roles(workspaceAddress), { method: 'POST', body: input }),
    update: (workspaceAddress: string, roleId: string, input: TRoleInput) =>
      api<IRoleResponse>(apiPath.role(workspaceAddress, roleId), { method: 'PATCH', body: input }),
    remove: (workspaceAddress: string, roleId: string) =>
      api<IOkResponse>(apiPath.role(workspaceAddress, roleId), { method: 'DELETE' }),
  }
}
