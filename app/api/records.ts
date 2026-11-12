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
    list: (workspaceAddress: string, tableAddress: string, query: IRecordQueryState) =>
      api<IRecordPage>(apiPath.records(workspaceAddress, tableAddress), {
        query: toRecordQueryParams(query),
      }),
    detail: (workspaceAddress: string, tableAddress: string, recordAddress: string) =>
      api<IRecordDetail>(apiPath.record(workspaceAddress, tableAddress, recordAddress)),
    create: (workspaceAddress: string, tableAddress: string, data: TRecordData) =>
      api<IRecordCreatedResponse>(apiPath.records(workspaceAddress, tableAddress), {
        method: 'POST',
        body: data,
      }),
    update: (
      workspaceAddress: string,
      tableAddress: string,
      recordAddress: string,
      data: TRecordData,
    ) =>
      api<IRecordResponse>(apiPath.record(workspaceAddress, tableAddress, recordAddress), {
        method: 'PATCH',
        body: data,
      }),
    remove: (workspaceAddress: string, tableAddress: string, recordAddress: string) =>
      api<IRecordDeletedResponse>(apiPath.record(workspaceAddress, tableAddress, recordAddress), {
        method: 'DELETE',
      }),
  }
}
