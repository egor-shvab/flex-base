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
