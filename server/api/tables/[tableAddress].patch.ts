import { defineEventHandler, readValidatedBody } from 'h3'
import { requireUser } from '#server/utils/auth'
import { routeParam } from '#server/utils/route'
import { TableService } from '#server/services/tables'
import { tableInputSchema } from '#shared/validation/table'
import type { ITableListItemResponse } from '#shared/types/api'

// Not a `defineTableHandler`: `renameTable` scopes on `userId` inside its own `where` clause —
// the form `CLAUDE.md` §5 prefers — so a pre-check would be a second round trip. Its signature
// requires the `userId`, so ownership cannot be forgotten here.
export default defineEventHandler(async (event): Promise<ITableListItemResponse> => {
  const user = requireUser(event)
  const tableAddress = routeParam(event, 'tableAddress')
  const { name } = await readValidatedBody(event, tableInputSchema.parse)
  const table = await TableService.renameTable(user.id, tableAddress, name)
  return { table }
})
