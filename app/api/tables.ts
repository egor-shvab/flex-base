import { useApi } from '~/api/client'
import { apiPath } from '~/api/paths'
import type {
  IOkResponse,
  ITableListItemResponse,
  ITableResponse,
  ITablesResponse,
} from '#shared/types/api'
import type { TTableInput } from '#shared/validation/table'

/**
 * The table endpoints. Holds no state and no reactivity — that is what keeps this a transport
 * layer rather than a second store: a function per route, typed from the shared contract.
 */
export function useTablesApi() {
  const api = useApi()

  return {
    list: () => api<ITablesResponse>(apiPath.tables),
    /** The read of one table, without the counts — what both table screens open with. */
    get: (tableId: string) => api<ITableResponse>(apiPath.table(tableId)),
    create: (input: TTableInput) =>
      api<ITableListItemResponse>(apiPath.tables, { method: 'POST', body: input }),
    rename: (tableId: string, input: TTableInput) =>
      api<ITableListItemResponse>(apiPath.table(tableId), { method: 'PATCH', body: input }),
    remove: (tableId: string) => api<IOkResponse>(apiPath.table(tableId), { method: 'DELETE' }),
  }
}
