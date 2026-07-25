import { listTables } from '../../services/tables'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const tables = await listTables(user.id)
  return { tables }
})
