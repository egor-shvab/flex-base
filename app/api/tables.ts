import { useApi } from '~/api/client'
import { apiPath } from '~/api/paths'
import type {
  IOkResponse,
  ITableListItemResponse,
  ITableResponse,
  ITablesResponse,
} from '#shared/types/api'
import type { TTableInput } from '#shared/validation/table'

export function useTablesApi() {
  const api = useApi()

  return {
    list: (workspaceAddress: string) => api<ITablesResponse>(apiPath.tables(workspaceAddress)),
    get: (workspaceAddress: string, tableAddress: string) =>
      api<ITableResponse>(apiPath.table(workspaceAddress, tableAddress)),
    create: (workspaceAddress: string, input: TTableInput) =>
      api<ITableListItemResponse>(apiPath.tables(workspaceAddress), {
        method: 'POST',
        body: input,
      }),
    rename: (workspaceAddress: string, tableAddress: string, input: TTableInput) =>
      api<ITableListItemResponse>(apiPath.table(workspaceAddress, tableAddress), {
        method: 'PATCH',
        body: input,
      }),
    remove: (workspaceAddress: string, tableAddress: string) =>
      api<IOkResponse>(apiPath.table(workspaceAddress, tableAddress), { method: 'DELETE' }),
  }
}
