import { readValidatedBody } from 'h3'
import { defineTableHandler } from '#server/utils/handler'
import { requireFieldTarget } from '#server/utils/ownership'
import { createField } from '#server/services/fields'
import { fieldInputSchema } from '#shared/validation/field'

export default defineTableHandler(async ({ event, user, table }) => {
  const input = await readValidatedBody(event, fieldInputSchema.parse)
  await requireFieldTarget(user.id, input)
  const field = await createField(table.id, input)
  return { field }
})
