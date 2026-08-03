/**
 * A URL query as the router hands one over: a value, or the repeats of one. Spelled out here
 * rather than imported from `vue-router`, which `shared/` deliberately cannot see — and kept
 * assignable in both directions, so a codec can read `route.query` and hand back something a
 * `<NuxtLink to>` accepts. `undefined` is a value the router drops, which is how a codec
 * removes a param rather than emitting an empty one.
 */
export type TUrlQueryValue = string | null | undefined

export type TUrlQuery = Record<string, TUrlQueryValue | TUrlQueryValue[]>
