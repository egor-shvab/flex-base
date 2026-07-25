import { updateField } from '../../../../services/fields'
import { fieldSchema } from '#shared/validation/field'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const tableId = getRouterParam(event, 'tableId') ?? ''
  const fieldId = getRouterParam(event, 'fieldId') ?? ''
  await requireOwnedTable(user.id, tableId)
  const input = await readValidatedBody(event, fieldSchema.parse)
  const field = await updateField(tableId, fieldId, input)
  return { field }
})
