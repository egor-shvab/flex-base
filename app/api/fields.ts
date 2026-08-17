import { useApi } from '~/api/client'
import { apiPath } from '~/api/paths'
import type { IFieldResponse, IFieldsResponse, IOkResponse } from '#shared/types/api'
import type { TFieldInput } from '#shared/validation/field'

export function useFieldsApi() {
  const api = useApi()

  return {
    list: (tableId: string) => api<IFieldsResponse>(apiPath.fields(tableId)),
    create: (tableId: string, input: TFieldInput) =>
      api<IFieldResponse>(apiPath.fields(tableId), { method: 'POST', body: input }),
    update: (tableId: string, fieldId: string, input: TFieldInput) =>
      api<IFieldResponse>(apiPath.field(tableId, fieldId), { method: 'PATCH', body: input }),
    remove: (tableId: string, fieldId: string) =>
      api<IOkResponse>(apiPath.field(tableId, fieldId), { method: 'DELETE' }),
  }
}
