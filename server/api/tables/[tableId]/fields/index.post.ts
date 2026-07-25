import { createField } from '../../../../services/fields'
import { fieldSchema } from '#shared/validation/field'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const tableId = getRouterParam(event, 'tableId') ?? ''
  await requireOwnedTable(user.id, tableId)
  const input = await readValidatedBody(event, fieldSchema.parse)
  const field = await createField(tableId, input)
  return { field }
})
