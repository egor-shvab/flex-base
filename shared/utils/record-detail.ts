import { DETAIL_PARAM } from '#shared/constants/filter'
import type { TUrlQuery } from '#shared/types/query'
import type { IOpenRecord } from '#shared/types/record'
import { singleParam } from '#shared/utils/query-param'

/**
 * The detail dialog lives in the URL as `?detail=<table>.<record>,<table>.<record>` — the
 * records it has open, outermost first. Only the last is shown; the rest are the trail Back
 * walks up, which is what makes drilling a matter of routing rather than of state on the side.
 *
 * Each half is an **address**: the row's public number, or the cuid an older link carries.
 * Neither separator can appear inside either form, so an older chain still decodes.
 */
const CHAIN_SEPARATOR = ','
const RECORD_SEPARATOR = '.'

function parseOpenRecord(raw: string): IOpenRecord | null {
  const parts = raw.split(RECORD_SEPARATOR)
  const [tableAddress, recordAddress] = parts

  if (parts.length !== 2 || !tableAddress || !recordAddress) return null
  return { tableAddress, recordAddress }
}

/**
 * Lenient like `parseRecordQueryState`: a malformed link degrades rather than throwing. The
 * chain **stops** at a bad entry instead of skipping it — a Back that silently jumped over a
 * record would be worse than a shorter trail.
 */
export function parseDetailChain(query: TUrlQuery): IOpenRecord[] {
  const raw = singleParam(query[DETAIL_PARAM])
  if (raw === undefined) return []

  const chain: IOpenRecord[] = []

  for (const entry of raw.split(CHAIN_SEPARATOR)) {
    const openRecord = parseOpenRecord(entry)
    if (openRecord === null) break
    chain.push(openRecord)
  }

  return chain
}

/** The inverse. An empty chain has no param at all, keeping a closed dialog a clean link. */
export function toDetailParam(chain: IOpenRecord[]): string | undefined {
  if (chain.length === 0) return undefined

  return chain
    .map((entry) => `${entry.tableAddress}${RECORD_SEPARATOR}${entry.recordAddress}`)
    .join(CHAIN_SEPARATOR)
}

/** Drilling into a relation keeps the trail behind it. */
export function pushDetail(chain: IOpenRecord[], target: IOpenRecord): IOpenRecord[] {
  return [...chain, target]
}

/** Going back one level; from the outermost record this closes the dialog. */
export function popDetail(chain: IOpenRecord[]): IOpenRecord[] {
  return chain.slice(0, -1)
}

/**
 * The current URL's query with a different chain in it — the single seam every link in this
 * feature is built from, so the list query it is layered onto always survives. An empty chain
 * yields `undefined`, which the router drops, so closing the dialog leaves no empty param.
 */
export function withDetailChain(query: TUrlQuery, chain: IOpenRecord[]): TUrlQuery {
  return { ...query, [DETAIL_PARAM]: toDetailParam(chain) }
}
