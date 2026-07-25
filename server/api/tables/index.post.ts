import { createTable } from '../../services/tables'
import { tableSchema } from '#shared/validation/table'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const { name } = await readValidatedBody(event, tableSchema.parse)
  const table = await createTable(user.id, name)
  return { table }
})
