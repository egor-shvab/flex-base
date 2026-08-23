import { defineEventHandler } from 'h3'
import { requireUser } from '#server/utils/auth'
import { TableService } from '#server/services/tables'
import type { ITablesResponse } from '#shared/types/api'

export default defineEventHandler(async (event): Promise<ITablesResponse> => {
  const user = requireUser(event)
  const tables = await TableService.listTables(user.id)
  return { tables }
})
