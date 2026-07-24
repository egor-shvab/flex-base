import type { FetchError } from 'ofetch'

// useRequestFetch forwards the incoming request's cookies during SSR,
// so authenticated API calls work server-side; on the client it is plain $fetch.
export function useApi() {
  return useRequestFetch()
}

export function getApiErrorMessage(error: unknown): string {
  const fetchError = error as FetchError
  return (
    fetchError?.data?.statusMessage ??
    fetchError?.data?.message ??
    'Something went wrong. Please try again.'
  )
}
