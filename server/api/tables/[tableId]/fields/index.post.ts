import { defineEventHandler, getRouterParam, readValidatedBody } from 'h3'
import { requireUser } from '#server/utils/auth'
import { requireOwnedTable } from '#server/utils/ownership'
import { createField } from '#server/services/fields'
import { fieldSchema } from '#shared/validation/field'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const tableId = getRouterParam(event, 'tableId') ?? ''
  await requireOwnedTable(user.id, tableId)
  const input = await readValidatedBody(event, fieldSchema.parse)
  const field = await createField(tableId, input)
  return { field }
})
