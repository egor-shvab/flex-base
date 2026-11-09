import { useRoute } from '#imports'
import type { TUrlQuery } from '#shared/types/query'
import type { IOpenRecord } from '#shared/types/record'
import {
  parseDetailChain,
  buildChildDetailChain,
  buildQueryWithDetailChain,
} from '#shared/utils/record-detail'

export function useDetailLink() {
  const route = useRoute()

  return (target: IOpenRecord): { query: TUrlQuery } => ({
    query: buildQueryWithDetailChain(
      route.query,
      buildChildDetailChain(parseDetailChain(route.query), target),
    ),
  })
}
