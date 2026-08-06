/**
 * A URL query as the router hands one over: a value, or the repeats of one. Spelled out here
 * rather than imported from `vue-router`, which `shared/` deliberately cannot see — and kept
 * assignable in both directions, so a codec can read `route.query` and hand back something a
 * `<NuxtLink to>` accepts. `undefined` is a value the router drops, which is how a codec
 * removes a param rather than emitting an empty one.
 */
export type TUrlQueryValue = string | null | undefined

export type TUrlQuery = Record<string, TUrlQueryValue | TUrlQueryValue[]>

/**
 * A query being *built* rather than read: every param is present and carries either one
 * value or a repeat of one (`?stage=Won&stage=Lost`). Assignable to `TUrlQuery`, so what a
 * codec emits goes straight to `navigateTo`, `<NuxtLink to>` or `$fetch`'s `query`.
 */
export type TQueryParams = Record<string, string | string[]>
