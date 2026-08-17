import { useApi } from '~/api/client'
import { apiPath } from '~/api/paths'
import type {
  IRecordCreatedResponse,
  IRecordDeletedResponse,
  IRecordResponse,
} from '#shared/types/api'
import type {
  IRecordDetail,
  IRecordPage,
  IRecordQueryState,
  TRecordData,
} from '#shared/types/record'
import { toRecordQueryParams } from '#shared/utils/record-query'

/**
 * The record endpoints. `list` takes the query as the domain model every other layer holds and
 * serializes it here — the flat params are the wire's shape, and this is the wire.
 *
 * `IRecordPage` and `IRecordDetail` are whole responses already, so neither is wrapped in an
 * envelope the way a single record is.
 */
export function useRecordsApi() {
  const api = useApi()

  return {
    list: (tableId: string, query: IRecordQueryState) =>
      api<IRecordPage>(apiPath.records(tableId), { query: toRecordQueryParams(query) }),
    detail: (tableId: string, recordId: string) =>
      api<IRecordDetail>(apiPath.record(tableId, recordId)),
    create: (tableId: string, data: TRecordData) =>
      api<IRecordCreatedResponse>(apiPath.records(tableId), { method: 'POST', body: data }),
    update: (tableId: string, recordId: string, data: TRecordData) =>
      api<IRecordResponse>(apiPath.record(tableId, recordId), { method: 'PATCH', body: data }),
    remove: (tableId: string, recordId: string) =>
      api<IRecordDeletedResponse>(apiPath.record(tableId, recordId), { method: 'DELETE' }),
  }
}
