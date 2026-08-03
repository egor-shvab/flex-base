import type { IField } from '#shared/types/field'
import type { IRecordSort, TRecordFilterValues, TSortDirection } from '#shared/types/filter'
import type { ITable } from '#shared/types/table'

/** Every value a record cell can hold. Records are stored as JSONB keyed by `Field.key`. */
export type TRecordValue = string | number | boolean | null

export type TRecordData = Record<string, TRecordValue>

export interface IRecord {
  id: string
  /**
   * The id a user reads — sequential within its own table, unlike `id`, which is a cuid
   * because it is what relations reference and what the API addresses.
   */
  number: number
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
  /**
   * Display labels for every relation value on this page, keyed by the relation field's id
   * and then by the target record's id. Resolved server-side, so a cell reads correctly
   * however large the target table is; keyed per field, because two relation fields may
   * point at one table through different label fields.
   */
  relationLabels: Record<string, Record<string, string>>
}

/** A target record as a relation picker offers it — the id it stores, and what it reads as. */
export interface IRecordOption {
  id: string
  label: string
}

/**
 * One record addressed from anywhere: a relation only stores the target's id, so the table it
 * belongs to has to travel with it. This is what the `detail` URL param encodes.
 */
export interface IRecordDetailRef {
  tableId: string
  recordId: string
}

/**
 * Everything the detail dialog renders, in one response. The fields come along because the
 * dialog draws a record of a table the page is not about, and the server needs them to resolve
 * the relation labels regardless — so they are already in hand, and fetching them separately
 * would cost a second round trip and a second loading state for one dialog.
 */
export interface IRecordDetail {
  table: Pick<ITable, 'id' | 'name'>
  fields: IField[]
  record: IRecord
  /** Keyed exactly like `IRecordPage`'s, so the same client cache ingests both. */
  relationLabels: Record<string, Record<string, string>>
}

/**
 * A resolved list query — what the client holds and passes around, and what the API
 * validated a request down to. Serialized to flat params only at the URL/fetch boundary.
 */
export interface IRecordQueryState {
  page: number
  sort: IRecordSort
  /** Every active filter, ANDed together. */
  filters: TRecordFilterValues
  /**
   * Free text matched across the table's searchable fields, ORed together and ANDed with
   * the filters. Empty means "not searching".
   */
  search: string
}

/** The server additionally resolves the page size it enforces. */
export interface IRecordQuery extends IRecordQueryState {
  pageSize: number
}

/**
 * What the list-query schema guarantees: validated pagination and sorting, with the
 * table's filter params riding along as raw strings for the codec to decode.
 */
export interface IRecordQueryParams extends Record<string, unknown> {
  page: number
  pageSize: number
  sort?: string
  dir: TSortDirection
  search?: string
}
