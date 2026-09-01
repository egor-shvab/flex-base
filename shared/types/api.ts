import type { IAuthUser } from '#shared/types/auth'
import type { IField } from '#shared/types/field'
import type { IRecord, IRecordOption } from '#shared/types/record'
import type { ITable, ITableListItem } from '#shared/types/table'

/**
 * What each endpoint answers with — **the contract, declared once and satisfied from both
 * sides**. A handler annotates its return type with one of these and the matching function in
 * `app/api/` reads the same one, so a response shape cannot move on the server without failing
 * to compile on the client.
 *
 * Only the **envelopes** live here; the payloads are the domain types, and `IRecordPage` /
 * `IRecordDetail` are already whole responses.
 *
 * These describe what travels **on the wire**, so every timestamp is an ISO string — which is
 * why `db/` maps a row's `Date`s rather than leaving `JSON.stringify` to agree by coincidence.
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
 * A write that answers with the table's list row, counts and all, so the client stores what it
 * was told rather than computing a delta (`docs/decisions.md`).
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
