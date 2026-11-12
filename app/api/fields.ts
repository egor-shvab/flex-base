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
    list: (workspaceAddress: string, tableAddress: string) =>
      api<IFieldsResponse>(apiPath.fields(workspaceAddress, tableAddress)),
    create: (workspaceAddress: string, tableAddress: string, input: TFieldInput) =>
      api<IFieldCreatedResponse>(apiPath.fields(workspaceAddress, tableAddress), {
        method: 'POST',
        body: input,
      }),
    update: (workspaceAddress: string, tableAddress: string, fieldId: string, input: TFieldInput) =>
      api<IFieldResponse>(apiPath.field(workspaceAddress, tableAddress, fieldId), {
        method: 'PATCH',
        body: input,
      }),
    remove: (workspaceAddress: string, tableAddress: string, fieldId: string) =>
      api<IFieldDeletedResponse>(apiPath.field(workspaceAddress, tableAddress, fieldId), {
        method: 'DELETE',
      }),
  }
}
