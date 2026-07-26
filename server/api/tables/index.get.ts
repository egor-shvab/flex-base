import { defineEventHandler } from 'h3'
import { requireUser } from '#server/utils/auth'
import { listTables } from '#server/services/tables'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const tables = await listTables(user.id)
  return { tables }
})
