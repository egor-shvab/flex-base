import { defineEventHandler, readValidatedBody } from 'h3'
import { requireUser } from '#server/utils/auth'
import { createTable } from '#server/services/tables'
import { tableInputSchema } from '#shared/validation/table'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const { name } = await readValidatedBody(event, tableInputSchema.parse)
  const table = await createTable(user.id, name)
  return { table }
})
