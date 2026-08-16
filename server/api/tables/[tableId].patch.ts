import { defineEventHandler, getRouterParam, readValidatedBody } from 'h3'
import { requireUser } from '#server/utils/auth'
import { renameTable } from '#server/services/tables'
import { tableInputSchema } from '#shared/validation/table'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const tableId = getRouterParam(event, 'tableId') ?? ''
  const { name } = await readValidatedBody(event, tableInputSchema.parse)
  const table = await renameTable(user.id, tableId, name)
  return { table }
})
