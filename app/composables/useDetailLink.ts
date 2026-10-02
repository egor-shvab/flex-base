import { useRoute } from '#imports'
import type { TUrlQuery } from '#shared/types/query'
import type { IOpenRecord } from '#shared/types/record'
import { parseDetailChain, pushDetail, withDetailChain } from '#shared/utils/record-detail'

export function useDetailLink() {
  const route = useRoute()

  return (target: IOpenRecord): { query: TUrlQuery } => ({
    query: withDetailChain(route.query, pushDetail(parseDetailChain(route.query), target)),
  })
}
