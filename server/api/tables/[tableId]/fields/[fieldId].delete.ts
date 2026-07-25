import { deleteField } from '../../../../services/fields'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const tableId = getRouterParam(event, 'tableId') ?? ''
  const fieldId = getRouterParam(event, 'fieldId') ?? ''
  await requireOwnedTable(user.id, tableId)
  await deleteField(tableId, fieldId)
  return { ok: true }
})
