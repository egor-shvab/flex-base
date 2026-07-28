import { useRequestFetch } from '#imports'

// useRequestFetch forwards the incoming request's cookies during SSR,
// so authenticated API calls work server-side; on the client it is plain $fetch.
export function useApi() {
  return useRequestFetch()
}
