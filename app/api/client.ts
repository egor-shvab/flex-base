import { useRequestFetch } from '#imports'

/**
 * The version an edit form was opened on, as the `If-Match` the server compares against; none for
 * something that has no stored version.
 */
export function buildIfMatchHeaders(readUpdatedAt: string | undefined): Record<string, string> {
  return readUpdatedAt === undefined ? {} : { 'If-Match': `"${readUpdatedAt}"` }
}

export function useApi() {
  return useRequestFetch()
}
