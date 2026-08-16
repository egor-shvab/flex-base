import { defineEventHandler, getRouterParam, readValidatedBody } from 'h3'
import { requireUser } from '#server/utils/auth'
import { requireFieldTarget, requireOwnedTable } from '#server/utils/ownership'
import { updateField } from '#server/services/fields'
import { fieldInputSchema } from '#shared/validation/field'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const tableId = getRouterParam(event, 'tableId') ?? ''
  const fieldId = getRouterParam(event, 'fieldId') ?? ''
  await requireOwnedTable(user.id, tableId)
  const input = await readValidatedBody(event, fieldInputSchema.parse)
  await requireFieldTarget(user.id, input)
  const field = await updateField(tableId, fieldId, input)
  return { field }
})
