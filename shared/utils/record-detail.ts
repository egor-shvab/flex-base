import { DETAIL_PARAM } from '#shared/constants/filter'
import type { TUrlQuery } from '#shared/types/query'
import type { IOpenRecord } from '#shared/types/record'
import { singleParam } from '#shared/utils/query-param'

const CHAIN_SEPARATOR = ','
const RECORD_SEPARATOR = '.'

function parseOpenRecord(raw: string): IOpenRecord | null {
  const parts = raw.split(RECORD_SEPARATOR)
  const [tableAddress, recordAddress] = parts

  if (parts.length !== 2 || !tableAddress || !recordAddress) return null
  return { tableAddress, recordAddress }
}

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

export function toDetailParam(chain: IOpenRecord[]): string | undefined {
  if (chain.length === 0) return undefined

  return chain
    .map((entry) => `${entry.tableAddress}${RECORD_SEPARATOR}${entry.recordAddress}`)
    .join(CHAIN_SEPARATOR)
}

export function pushDetail(chain: IOpenRecord[], target: IOpenRecord): IOpenRecord[] {
  return [...chain, target]
}

export function popDetail(chain: IOpenRecord[]): IOpenRecord[] {
  return chain.slice(0, -1)
}

export function withDetailChain(query: TUrlQuery, chain: IOpenRecord[]): TUrlQuery {
  return { ...query, [DETAIL_PARAM]: toDetailParam(chain) }
}
