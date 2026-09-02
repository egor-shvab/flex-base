import type { IField } from '#shared/types/field'
import type { IRecordSort, TRecordFilterValues, TSortDirection } from '#shared/types/filter'
import type { ITable } from '#shared/types/table'

/**
 * **One** value — what a single-value field stores, one element of a multi-value one, and what
 * a per-type cell renders. Named apart from `TRecordValue` because most of the layer genuinely
 * handles one value, and the wider union in such a position is a type that lies — on a
 * component, a runtime prop check that lies with it.
 */
export type TRecordSingleValue = string | number | boolean | null

/**
 * Every value a record's `data` can hold, stored as JSONB keyed by `Field.key`. `string[]` is
 * what a **multi-value** field stores, so every guard over this union must separate the array
 * case. `TRecordValue` stays a subset of `TFilterValue`, so a control table typed on the latter
 * still accepts a record value.
 */
export type TRecordValue = TRecordSingleValue | string[]

export type TRecordData = Record<string, TRecordValue>

export interface IRecord {
  id: string
  /**
   * The id a user reads and a URL addresses, sequential within its table. `id` stays a cuid
   * because it is what a relation *references*, inside `data` with no foreign key.
   */
  number: number
  data: TRecordData
  createdAt: string
  updatedAt: string
}

/** Records are always served page by page — an endpoint never returns a whole table. */
export interface IRecordPage {
  records: IRecord[]
  /**
   * Matching records, counted no further than `RECORD_COUNT_CAP` — so this is the exact total
   * only while `totalCapped` is false, and the cap itself once it is true.
   */
  total: number
  /**
   * Whether there are more matches than `total` says. Every reader of a total branches on it:
   * `1000` and "at least 1000" are different claims.
   */
  totalCapped: boolean
  page: number
  pageSize: number
  /**
   * How every relation value on this page reads, keyed by relation field id then target record
   * id. Resolved server-side, so a cell is correct however large the target table is; per
   * field, because two relation fields may point at one table through different labels.
   */
  linkedRecords: Record<string, Record<string, ILinkedRecord>>
}

/**
 * How a linked record reads: its number, plus whatever its label field says. Apart rather than
 * pre-joined, because only a renderer knows whether it can style them differently — and a
 * flattened `#3 Example` can never be taken apart again.
 */
export interface ILinkedRecord {
  number: number
  /** The label field's value — `null` when blank, missing, or an empty list. Never `#N`. */
  label: string | null
}

/** A target record as a relation picker offers it — the id it stores, and how it reads. */
export interface IRecordOption extends ILinkedRecord {
  id: string
}

/**
 * One record addressed from anywhere: a relation stores only the target's id, so its table has
 * to travel with it. This is what the `detail` URL param encodes — the trail of records the
 * dialog has open.
 *
 * **Addresses, not ids**: the row's public number going forward, or the cuid an older link
 * holds. Strings either way, because a URL has nothing else, and the API reads both.
 */
export interface IOpenRecord {
  tableAddress: string
  recordAddress: string
}

/**
 * Everything the detail dialog renders, in one response. The fields come along because the
 * dialog draws a record of a table the page is not about, and the server needs them to resolve
 * the relation labels anyway — so fetching them separately would cost a second round trip.
 */
export interface IRecordDetail {
  table: Pick<ITable, 'id' | 'number' | 'name'>
  fields: IField[]
  record: IRecord
  /** Keyed exactly like `IRecordPage`'s, so the same client cache ingests both. */
  linkedRecords: Record<string, Record<string, ILinkedRecord>>
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
