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
 * into existence**, so a handler cannot be written that forgets it. Otherwise the rule is
 * enforced by review alone, and a handler that skipped it would compile, lint, type-check and
 * serve another user's rows.
 *
 * **Exactly one factory per `require*` helper in `ownership.ts`, and that is the whole list.**
 * Not a general middleware layer: a handler needing a shape none of them covers adds a factory
 * rather than reaching past them into `requireUser`.
 *
 * **Two table routes deliberately use none of these** — `[tableAddress].patch` and `.delete`.
 * Their services take a `userId` and scope on it in their own `where` clause, the form
 * `CLAUDE.md` §5 prefers, and a pre-check would be a second round trip for an answer the write
 * already gives. Forgetting ownership there is already a compile error.
 *
 * Each is generic in its return type, so Nitro still infers what a route answers with.
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
    const table = await requireOwnedTable(user.id, routeParam(event, 'tableAddress'))

    return handler({ event, user, table })
  })
}

/**
 * The table's field metadata, from the same scoped query as the ownership check — reads need it
 * to resolve sort and filter params, so fetching it separately is a second round trip.
 */
export function defineFieldsHandler<T>(
  handler: (context: IHandlerContext & { tableId: string; fields: IField[] }) => Promise<T>,
) {
  return defineEventHandler(async (event): Promise<T> => {
    const user = requireUser(event)
    // The raw address, whatever form it is in; the helper resolves it to the table's id
    const { tableId, fields } = await requireOwnedTableFields(
      user.id,
      routeParam(event, 'tableAddress'),
    )

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
      routeParam(event, 'tableAddress'),
    )

    return handler({ event, user, table, fields })
  })
}

/**
 * The same metadata, guaranteed non-empty. **Writes only:** a table with no fields has no record
 * shape to validate against, so writing to it is a 400 — but it must still list an empty page.
 */
export function defineRecordWriteHandler<T>(
  handler: (context: IHandlerContext & { tableId: string; fields: IField[] }) => Promise<T>,
) {
  return defineEventHandler(async (event): Promise<T> => {
    const user = requireUser(event)
    const { tableId, fields } = await requireRecordFields(
      user.id,
      routeParam(event, 'tableAddress'),
    )

    return handler({ event, user, tableId, fields })
  })
}
