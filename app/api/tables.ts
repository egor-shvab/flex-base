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
    list: () => api<ITablesResponse>(apiPath.tables),
    get: (tableAddress: string) => api<ITableResponse>(apiPath.table(tableAddress)),
    create: (input: TTableInput) =>
      api<ITableListItemResponse>(apiPath.tables, { method: 'POST', body: input }),
    rename: (tableAddress: string, input: TTableInput) =>
      api<ITableListItemResponse>(apiPath.table(tableAddress), { method: 'PATCH', body: input }),
    remove: (tableAddress: string) =>
      api<IOkResponse>(apiPath.table(tableAddress), { method: 'DELETE' }),
  }
}
