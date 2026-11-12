import type { IAuthUser } from '#shared/types/auth'
import type { IField } from '#shared/types/field'
import type { IRecord, IRecordOption } from '#shared/types/record'
import type { ITable, ITableListItem } from '#shared/types/table'
import type { IWorkspaceMembership } from '#shared/types/workspace'

export interface IOkResponse {
  ok: true
}

/**
 * The `data` of a 404 that says what is missing, so a page can name it without reading the
 * message. A 404 without it is the table's.
 */
export interface INotFoundData {
  missing: 'workspace'
}

export interface IAuthUserResponse {
  user: IAuthUser
}

export interface ITablesResponse {
  tables: ITableListItem[]
}

export interface ITableListItemResponse {
  table: ITableListItem
}

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

export interface IWorkspacesResponse {
  memberships: IWorkspaceMembership[]
  /** Only ever a workspace in `memberships`: one the caller has left is not offered back. */
  lastWorkspaceAddress: string | null
}

export interface IWorkspaceMembershipResponse {
  membership: IWorkspaceMembership
}
