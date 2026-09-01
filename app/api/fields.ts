import { useApi } from '~/api/client'
import { apiPath } from '~/api/paths'
import type {
  IFieldCreatedResponse,
  IFieldDeletedResponse,
  IFieldResponse,
  IFieldsResponse,
} from '#shared/types/api'
import type { TFieldInput } from '#shared/validation/field'

export function useFieldsApi() {
  const api = useApi()

  return {
    list: (tableAddress: string) => api<IFieldsResponse>(apiPath.fields(tableAddress)),
    create: (tableAddress: string, input: TFieldInput) =>
      api<IFieldCreatedResponse>(apiPath.fields(tableAddress), { method: 'POST', body: input }),
    update: (tableAddress: string, fieldId: string, input: TFieldInput) =>
      api<IFieldResponse>(apiPath.field(tableAddress, fieldId), { method: 'PATCH', body: input }),
    remove: (tableAddress: string, fieldId: string) =>
      api<IFieldDeletedResponse>(apiPath.field(tableAddress, fieldId), { method: 'DELETE' }),
  }
}
