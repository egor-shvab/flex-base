import { defineTableHandler } from '#server/utils/handler'
import { FieldService } from '#server/services/fields'
import type { IFieldsResponse } from '#shared/types/api'

export default defineTableHandler(async ({ table }): Promise<IFieldsResponse> => {
  const fields = await FieldService.listFields(table.id)
  return { fields }
})
