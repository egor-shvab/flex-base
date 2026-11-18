import { buildIfMatchHeaders, useApi } from '~/api/client'
import { apiPath } from '~/api/paths'
import type {
  IAccessTablesResponse,
  IOkResponse,
  IRoleDetailResponse,
  IRolesResponse,
} from '#shared/types/api'
import type { TRoleInput } from '#shared/validation/workspace'

export function useRolesApi() {
  const api = useApi()

  return {
    list: (workspaceAddress: string) => api<IRolesResponse>(apiPath.roles(workspaceAddress)),
    tables: (workspaceAddress: string) =>
      api<IAccessTablesResponse>(apiPath.roleTables(workspaceAddress)),
    get: (workspaceAddress: string, roleId: string) =>
      api<IRoleDetailResponse>(apiPath.role(workspaceAddress, roleId)),
    create: (workspaceAddress: string, input: TRoleInput) =>
      api<IRoleDetailResponse>(apiPath.roles(workspaceAddress), { method: 'POST', body: input }),
    update: (workspaceAddress: string, roleId: string, input: TRoleInput, readUpdatedAt: string) =>
      api<IRoleDetailResponse>(apiPath.role(workspaceAddress, roleId), {
        method: 'PUT',
        body: input,
        headers: buildIfMatchHeaders(readUpdatedAt),
      }),
    remove: (workspaceAddress: string, roleId: string) =>
      api<IOkResponse>(apiPath.role(workspaceAddress, roleId), { method: 'DELETE' }),
  }
}
