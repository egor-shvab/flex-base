import { defineTableHandler } from '#server/utils/handler'
import { listFields } from '#server/services/fields'
import type { IFieldsResponse } from '#shared/types/api'

export default defineTableHandler(async ({ table }): Promise<IFieldsResponse> => {
  const fields = await listFields(table.id)
  return { fields }
})
