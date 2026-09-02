import { useApi } from '~/api/client'
import { apiPath } from '~/api/paths'
import type { IOkResponse } from '#shared/types/api'
import type { TClientErrorReport } from '#shared/validation/client-error'

/**
 * Reporting an error the browser raised. The only endpoint the client calls that is not about the
 * user's data, and the only one whose failure must never be surfaced — see the plugin.
 */
export function useErrorsApi() {
  const api = useApi()

  return {
    report: (report: TClientErrorReport) =>
      api<IOkResponse>(apiPath.clientErrors, { method: 'POST', body: report }),
  }
}
