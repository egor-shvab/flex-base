import { renameTable } from '../../services/tables'
import { tableSchema } from '#shared/validation/table'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const tableId = getRouterParam(event, 'tableId') ?? ''
  const { name } = await readValidatedBody(event, tableSchema.parse)
  const table = await renameTable(user.id, tableId, name)
  return { table }
})
