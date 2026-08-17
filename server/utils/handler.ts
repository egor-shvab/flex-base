import { defineEventHandler, type H3Event } from 'h3'
import {
  requireOwnedTable,
  requireOwnedTableFields,
  requireOwnedTableWithFields,
  requireRecordFields,
} from '#server/utils/ownership'
import { requireUser } from '#server/utils/auth'
import { routeParam } from '#server/utils/route'
import type { IAuthUser } from '#shared/types/auth'
import type { IField } from '#shared/types/field'
import type { ITable } from '#shared/types/table'

/**
 * Handler factories for the table-scoped routes: **the ownership check is how the context comes
 * into existence**, so a handler cannot be written that forgets it. Before these, every one of
 * them opened with the same `requireUser` → `routeParam` → `require*` preamble, and the app's
 * central rule — a table-scoped request proves ownership first — was enforced by review alone: a
 * new handler that skipped it compiled, linted, type-checked and served another user's rows.
 *
 * **There is exactly one factory per `require*` helper in `ownership.ts`, and that is the whole
 * list.** They are not a general middleware layer, and a handler needing a shape none of them
 * covers adds a factory rather than reaching past them into `requireUser` — an options bag
 * covering four shapes would put the branching back, one level further from the route.
 *
 * **Two table routes deliberately use none of these** — `[tableId].patch` and `[tableId].delete`.
 * Their services take a `userId` and scope on it inside their own `where` clause, which is the
 * form `CLAUDE.md` §5 actually prefers; a pre-check would be a second round trip for an answer
 * the write already gives. Nothing is lost by their absence here, because those signatures
 * require the `userId` — forgetting ownership there is already a compile error, which is exactly
 * the property these factories add to the services that take only a `tableId`.
 *
 * Each is generic in its return type, so Nitro still infers what a route answers with; a factory
 * that flattened it to `unknown` would silently widen every response type in the app.
 */

/** What every context below carries: the request, and the user the middleware resolved. */
interface IHandlerContext {
  event: H3Event
  user: IAuthUser
}

/**
 * The table, proven to exist and to belong to the caller. A missing or foreign one is a 404
 * from `requireOwnedTable` before the body below ever runs.
 */
export function defineTableHandler<T>(
  handler: (context: IHandlerContext & { table: ITable }) => Promise<T>,
) {
  return defineEventHandler(async (event): Promise<T> => {
    const user = requireUser(event)
    const table = await requireOwnedTable(user.id, routeParam(event, 'tableId'))

    return handler({ event, user, table })
  })
}

/**
 * The table's field metadata, from the same scoped query as the ownership check — reads need it
 * to resolve sort and filter params, so fetching it separately would be a second round trip for
 * something the check already had to touch.
 */
export function defineFieldsHandler<T>(
  handler: (context: IHandlerContext & { tableId: string; fields: IField[] }) => Promise<T>,
) {
  return defineEventHandler(async (event): Promise<T> => {
    const user = requireUser(event)
    const tableId = routeParam(event, 'tableId')
    const fields = await requireOwnedTableFields(user.id, tableId)

    return handler({ event, user, tableId, fields })
  })
}

/**
 * The table **and** its fields. For the record-detail read, which has to name a table the page
 * it opened from is not about.
 */
export function defineTableWithFieldsHandler<T>(
  handler: (context: IHandlerContext & { table: ITable; fields: IField[] }) => Promise<T>,
) {
  return defineEventHandler(async (event): Promise<T> => {
    const user = requireUser(event)
    const { table, fields } = await requireOwnedTableWithFields(
      user.id,
      routeParam(event, 'tableId'),
    )

    return handler({ event, user, table, fields })
  })
}

/**
 * The same metadata, guaranteed non-empty. **Writes only:** a table with no fields has no record
 * shape to validate against, so writing to it is a 400 — while a field-less table must still
 * list an empty page, which is why the read factory above does not carry this guard.
 */
export function defineRecordWriteHandler<T>(
  handler: (context: IHandlerContext & { tableId: string; fields: IField[] }) => Promise<T>,
) {
  return defineEventHandler(async (event): Promise<T> => {
    const user = requireUser(event)
    const tableId = routeParam(event, 'tableId')
    const fields = await requireRecordFields(user.id, tableId)

    return handler({ event, user, tableId, fields })
  })
}
