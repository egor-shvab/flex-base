import { defineEventHandler } from 'h3'
import { requireUser } from '#server/utils/auth'
import { routeParam } from '#server/utils/route'
import { TableService } from '#server/services/tables'
import type { IOkResponse } from '#shared/types/api'

export default defineEventHandler(async (event): Promise<IOkResponse> => {
  const user = requireUser(event)
  const tableAddress = routeParam(event, 'tableAddress')
  await TableService.deleteTable(user.id, tableAddress)
  return { ok: true }
})
