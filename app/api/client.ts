import { useRequestFetch } from '#imports'

/**
 * The one fetcher every request in the app goes through. `useRequestFetch` forwards the incoming
 * request's cookies during SSR, so an authenticated call works server-side; on the client it is
 * plain `$fetch`. Its whole job is keeping callers off bare `$fetch`, which drops those cookies.
 *
 * It must be called during setup, which is why the modules beside it are `use*Api()` factories
 * rather than plain functions: a store calls one at setup time, a component in its own.
 */
export function useApi() {
  return useRequestFetch()
}
