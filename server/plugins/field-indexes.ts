import { defineNitroPlugin } from 'nitropack/runtime'
import { FieldService } from '#server/services/fields'
import { recordBackgroundFailure } from '#server/utils/error-log-file'

/**
 * Not awaited: `CREATE INDEX CONCURRENTLY` can run for minutes, and the server serves meanwhile —
 * a query only runs slower until its index lands. A failure reaches the error log.
 */
export default defineNitroPlugin(() => {
  void FieldService.reconcileIndexes().catch(recordBackgroundFailure)
})
