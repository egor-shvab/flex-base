import { useRoute } from '#imports'
import type { TUrlQuery } from '#shared/types/query'
import type { IOpenRecord } from '#shared/types/record'
import { parseDetailChain, pushDetail, withDetailChain } from '#shared/utils/record-detail'

/**
 * The route target that opens a record in the detail dialog.
 *
 * Opening a record is a URL, not an event, so every way into the dialog is an ordinary link —
 * a row's View action, a relation in a cell, a relation inside the dialog itself. Each appends
 * to whatever chain it is being rendered under, so a caller never has to know where it is: from
 * the table the chain is empty and this opens a record, from inside the dialog it drills.
 *
 * Layered onto the current query rather than built as a path, so the list view the dialog opens
 * over — its page, sort and filters — survives being navigated.
 */
export function useDetailLink() {
  const route = useRoute()

  return (target: IOpenRecord): { query: TUrlQuery } => ({
    query: withDetailChain(route.query, pushDetail(parseDetailChain(route.query), target)),
  })
}
