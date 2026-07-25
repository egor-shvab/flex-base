import { listFields } from '../../../../services/fields'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const tableId = getRouterParam(event, 'tableId') ?? ''
  await requireOwnedTable(user.id, tableId)
  const fields = await listFields(tableId)
  return { fields }
})
