import { defineEventHandler, readValidatedBody } from 'h3'
import { requireUser } from '#server/utils/auth'
import { routeParam } from '#server/utils/route'
import { renameTable } from '#server/services/tables'
import { tableInputSchema } from '#shared/validation/table'
import type { ITableListItemResponse } from '#shared/types/api'

// Not a `defineTableHandler`: `renameTable` scopes on `userId` inside its own `where` clause,
// which is the form CLAUDE.md §5 prefers, so a pre-check would be a second round trip for an
// answer the update already gives. Its signature requires the `userId`, so ownership cannot be
// forgotten here the way it could where a service takes only a `tableId`.
export default defineEventHandler(async (event): Promise<ITableListItemResponse> => {
  const user = requireUser(event)
  const tableId = routeParam(event, 'tableId')
  const { name } = await readValidatedBody(event, tableInputSchema.parse)
  const table = await renameTable(user.id, tableId, name)
  return { table }
})
