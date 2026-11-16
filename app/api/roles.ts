import { buildIfMatchHeaders, useApi } from '~/api/client'
import { apiPath } from '~/api/paths'
import type {
  IOkResponse,
  IRoleAccessResponse,
  IRoleResponse,
  IRolesResponse,
} from '#shared/types/api'
import type { TRoleAccessInput } from '#shared/validation/role-access'
import type { TRoleInput } from '#shared/validation/workspace'

export function useRolesApi() {
  const api = useApi()

  return {
    list: (workspaceAddress: string) => api<IRolesResponse>(apiPath.roles(workspaceAddress)),
    create: (workspaceAddress: string, input: TRoleInput) =>
      api<IRoleResponse>(apiPath.roles(workspaceAddress), { method: 'POST', body: input }),
    update: (workspaceAddress: string, roleId: string, input: TRoleInput, readUpdatedAt: string) =>
      api<IRoleResponse>(apiPath.role(workspaceAddress, roleId), {
        method: 'PATCH',
        body: input,
        headers: buildIfMatchHeaders(readUpdatedAt),
      }),
    remove: (workspaceAddress: string, roleId: string) =>
      api<IOkResponse>(apiPath.role(workspaceAddress, roleId), { method: 'DELETE' }),
    access: (workspaceAddress: string, roleId: string) =>
      api<IRoleAccessResponse>(apiPath.roleAccess(workspaceAddress, roleId)),
    updateAccess: (
      workspaceAddress: string,
      roleId: string,
      input: TRoleAccessInput,
      readUpdatedAt: string,
    ) =>
      api<IRoleAccessResponse>(apiPath.roleAccess(workspaceAddress, roleId), {
        method: 'PUT',
        body: input,
        headers: buildIfMatchHeaders(readUpdatedAt),
      }),
  }
}
