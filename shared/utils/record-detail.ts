import { DETAIL_PARAM } from '#shared/constants/filter'
import type { TUrlQuery } from '#shared/types/query'
import type { IRecordDetailRef } from '#shared/types/record'
import { singleParam } from '#shared/utils/query-param'

/**
 * The detail dialog lives in the URL as `?detail=<tableId>.<recordId>,<tableId>.<recordId>` —
 * the records it has open, outermost first. Only the last one is shown; the entries before it
 * are the trail Back walks up, which is what makes drilling through nested relations a matter
 * of routing rather than of state kept on the side.
 *
 * Both separators are outside the cuid alphabet, so neither can appear inside an id.
 */
const CHAIN_SEPARATOR = ','
const REF_SEPARATOR = '.'

function parseRef(raw: string): IRecordDetailRef | null {
  const parts = raw.split(REF_SEPARATOR)
  const [tableId, recordId] = parts

  if (parts.length !== 2 || !tableId || !recordId) return null
  return { tableId, recordId }
}

/**
 * Lenient like `parseRecordQueryState`: a malformed link degrades rather than throwing. The
 * chain **stops** at a bad entry instead of skipping it — a Back that silently jumped over a
 * record would be worse than a shorter trail.
 */
export function parseDetailChain(query: TUrlQuery): IRecordDetailRef[] {
  const raw = singleParam(query[DETAIL_PARAM])
  if (raw === undefined) return []

  const chain: IRecordDetailRef[] = []

  for (const entry of raw.split(CHAIN_SEPARATOR)) {
    const ref = parseRef(entry)
    if (ref === null) break
    chain.push(ref)
  }

  return chain
}

/** The inverse. An empty chain has no param at all, keeping a closed dialog a clean link. */
export function toDetailParam(chain: IRecordDetailRef[]): string | undefined {
  if (chain.length === 0) return undefined

  return chain.map((ref) => `${ref.tableId}${REF_SEPARATOR}${ref.recordId}`).join(CHAIN_SEPARATOR)
}

/** Drilling into a relation keeps the trail behind it. */
export function pushDetail(chain: IRecordDetailRef[], ref: IRecordDetailRef): IRecordDetailRef[] {
  return [...chain, ref]
}

/** Going back one level; from the outermost record this closes the dialog. */
export function popDetail(chain: IRecordDetailRef[]): IRecordDetailRef[] {
  return chain.slice(0, -1)
}

/**
 * The current URL's query with a different chain in it — the single seam every link in this
 * feature is built from, so the list query it is layered onto always survives. An empty chain
 * yields `undefined`, which the router drops, so closing the dialog leaves no empty param.
 */
export function withDetailChain(query: TUrlQuery, chain: IRecordDetailRef[]): TUrlQuery {
  return { ...query, [DETAIL_PARAM]: toDetailParam(chain) }
}
