import type { IRecordFilter, IRecordSort, TSortDirection } from '#shared/types/filter'

/** Every value a record cell can hold. Records are stored as JSONB keyed by `Field.key`. */
export type TRecordValue = string | number | boolean | null

export type TRecordData = Record<string, TRecordValue>

export interface IRecord {
  id: string
  data: TRecordData
  createdAt: string
  updatedAt: string
}

/** Records are always served page by page — an endpoint never returns a whole table. */
export interface IRecordPage {
  records: IRecord[]
  total: number
  page: number
  pageSize: number
}

/** A resolved list query: what the API validated the request down to. */
export interface IRecordQuery {
  page: number
  pageSize: number
  sort: IRecordSort
  /** Every active condition, ANDed together. */
  filters: IRecordFilter[]
}

/**
 * What the client holds and passes around — the same information as `IRecordQuery`,
 * minus the server-only page size. Serialized to flat params only at the fetch boundary,
 * since a URL carries strings rather than decoded field values.
 */
export interface IRecordQueryState {
  page?: number
  sort?: string
  dir?: TSortDirection
  filters: IRecordFilter[]
}
