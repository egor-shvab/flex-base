import { useApi } from '~/api/client'
import { apiPath } from '~/api/paths'
import type { IOkResponse } from '#shared/types/api'
import type { TClientErrorReport } from '#shared/validation/client-error'

export function useErrorsApi() {
  const api = useApi()

  return {
    report: (report: TClientErrorReport) =>
      api<IOkResponse>(apiPath.clientErrors, { method: 'POST', body: report }),
  }
}
