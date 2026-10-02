export type TUrlQueryValue = string | null | undefined

export type TUrlQuery = Record<string, TUrlQueryValue | TUrlQueryValue[]>

export type TQueryParams = Record<string, string | string[]>
