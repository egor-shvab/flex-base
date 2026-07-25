import { deleteTable } from '../../services/tables'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const tableId = getRouterParam(event, 'tableId') ?? ''
  await deleteTable(user.id, tableId)
  return { ok: true }
})
