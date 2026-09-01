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
    list: (tableAddress: string, query: IRecordQueryState) =>
      api<IRecordPage>(apiPath.records(tableAddress), { query: toRecordQueryParams(query) }),
    detail: (tableAddress: string, recordAddress: string) =>
      api<IRecordDetail>(apiPath.record(tableAddress, recordAddress)),
    create: (tableAddress: string, data: TRecordData) =>
      api<IRecordCreatedResponse>(apiPath.records(tableAddress), { method: 'POST', body: data }),
    update: (tableAddress: string, recordAddress: string, data: TRecordData) =>
      api<IRecordResponse>(apiPath.record(tableAddress, recordAddress), {
        method: 'PATCH',
        body: data,
      }),
    remove: (tableAddress: string, recordAddress: string) =>
      api<IRecordDeletedResponse>(apiPath.record(tableAddress, recordAddress), {
        method: 'DELETE',
      }),
  }
}
