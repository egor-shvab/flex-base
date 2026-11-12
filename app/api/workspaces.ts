import { useApi } from '~/api/client'
import { apiPath } from '~/api/paths'
import type {
  IOkResponse,
  IWorkspaceMembershipResponse,
  IWorkspacesResponse,
} from '#shared/types/api'

export function useWorkspacesApi() {
  const api = useApi()

  return {
    list: () => api<IWorkspacesResponse>(apiPath.workspaces),
    get: (workspaceAddress: string) =>
      api<IWorkspaceMembershipResponse>(apiPath.workspace(workspaceAddress)),
    rememberLast: (workspaceAddress: string) =>
      api<IOkResponse>(apiPath.workspaceVisit(workspaceAddress), { method: 'PUT' }),
  }
}
