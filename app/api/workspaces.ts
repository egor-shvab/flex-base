import { useApi } from '~/api/client'
import { apiPath } from '~/api/paths'
import type {
  IOkResponse,
  IWorkspaceMembershipResponse,
  IWorkspaceResponse,
  IWorkspacesResponse,
} from '#shared/types/api'
import type { TTransferOwnershipInput, TWorkspaceInput } from '#shared/validation/workspace'

export function useWorkspacesApi() {
  const api = useApi()

  return {
    list: () => api<IWorkspacesResponse>(apiPath.workspaces),
    get: (workspaceAddress: string) =>
      api<IWorkspaceMembershipResponse>(apiPath.workspace(workspaceAddress)),
    create: (input: TWorkspaceInput) =>
      api<IWorkspaceMembershipResponse>(apiPath.workspaces, { method: 'POST', body: input }),
    rename: (workspaceAddress: string, input: TWorkspaceInput) =>
      api<IWorkspaceResponse>(apiPath.workspace(workspaceAddress), {
        method: 'PATCH',
        body: input,
      }),
    remove: (workspaceAddress: string) =>
      api<IOkResponse>(apiPath.workspace(workspaceAddress), { method: 'DELETE' }),
    rememberLast: (workspaceAddress: string) =>
      api<IOkResponse>(apiPath.workspaceVisit(workspaceAddress), { method: 'PUT' }),
    transfer: (workspaceAddress: string, input: TTransferOwnershipInput) =>
      api<IOkResponse>(apiPath.workspaceTransfer(workspaceAddress), {
        method: 'POST',
        body: input,
      }),
    leave: (workspaceAddress: string) =>
      api<IOkResponse>(apiPath.workspaceLeave(workspaceAddress), { method: 'POST' }),
  }
}
