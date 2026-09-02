/**
 * A URL query as the router hands one over: a value, or the repeats of one. Spelled out rather
 * than imported from `vue-router`, which `shared/` cannot see, and assignable both ways so a
 * codec can read `route.query` and hand back something `<NuxtLink to>` accepts. `undefined` is
 * dropped by the router, which is how a codec removes a param.
 */
export type TUrlQueryValue = string | null | undefined

export type TUrlQuery = Record<string, TUrlQueryValue | TUrlQueryValue[]>

/**
 * A query being *built* rather than read: every param is present and carries either one
 * value or a repeat of one (`?stage=Won&stage=Lost`). Assignable to `TUrlQuery`, so what a
 * codec emits goes straight to `navigateTo`, `<NuxtLink to>` or `$fetch`'s `query`.
 */
export type TQueryParams = Record<string, string | string[]>
