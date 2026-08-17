import { readValidatedBody } from 'h3'
import { defineTableHandler } from '#server/utils/handler'
import { requireFieldTarget } from '#server/utils/ownership'
import { routeParam } from '#server/utils/route'
import { updateField } from '#server/services/fields'
import { fieldInputSchema } from '#shared/validation/field'
import type { IFieldResponse } from '#shared/types/api'

export default defineTableHandler(async ({ event, user, table }): Promise<IFieldResponse> => {
  const fieldId = routeParam(event, 'fieldId')
  const input = await readValidatedBody(event, fieldInputSchema.parse)
  await requireFieldTarget(user.id, input)
  const field = await updateField(table.id, fieldId, input)
  return { field }
})
