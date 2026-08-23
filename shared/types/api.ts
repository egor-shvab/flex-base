import type { IAuthUser } from '#shared/types/auth'
import type { IField } from '#shared/types/field'
import type { IRecord, IRecordOption } from '#shared/types/record'
import type { ITable, ITableListItem } from '#shared/types/table'

/**
 * What each endpoint answers with — **the contract, declared once and satisfied from both sides**.
 * A handler annotates its return type with one of these; the matching function in `app/api/`
 * reads the same one, so a response shape cannot move on the server without failing to compile
 * on the client. Before this, every call site asserted a shape the compiler never checked
 * against the handler.
 *
 * Only the **envelopes** live here. The payloads inside them are the domain types they always
 * were, and `IRecordPage` / `IRecordDetail` are already whole responses in their own right — an
 * alias for either would be a second name for one thing.
 *
 * These describe what travels **on the wire**, so every timestamp is an ISO string. That is why
 * `db/` maps a row's `Date`s rather than leaving JSON to do it silently: the two agreed only
 * because `JSON.stringify` happened to produce the same text a declared `string` promised.
 */

/** Every mutation whose whole answer is that it worked. */
export interface IOkResponse {
  ok: true
}

export interface IAuthUserResponse {
  user: IAuthUser
}

export interface ITablesResponse {
  tables: ITableListItem[]
}

/**
 * A write that answers with the table's list row, counts and all — what the sidebar and the
 * dashboard redraw from, so the client stores what it was told rather than computing a delta
 * against what it last saw (`decisions.md` → _A cached count is received, not computed_).
 */
export interface ITableListItemResponse {
  table: ITableListItem
}

/** A read of one table answers without the counts, which only the list surfaces need. */
export interface ITableResponse {
  table: ITable
}

export interface IFieldsResponse {
  fields: IField[]
}

export interface IFieldResponse {
  field: IField
}

export interface IFieldCreatedResponse extends ITableListItemResponse {
  field: IField
}

export interface IFieldDeletedResponse extends ITableListItemResponse {
  ok: true
}

export interface IRecordResponse {
  record: IRecord
}

export interface IRecordCreatedResponse extends ITableListItemResponse {
  record: IRecord
}

export interface IRecordDeletedResponse extends ITableListItemResponse {
  ok: true
}

export interface IRelationOptionsResponse {
  options: IRecordOption[]
}
