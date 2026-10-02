import type { IAuthUser } from '#shared/types/auth'
import type { IField } from '#shared/types/field'
import type { IRecord, IRecordOption } from '#shared/types/record'
import type { ITable, ITableListItem } from '#shared/types/table'

export interface IOkResponse {
  ok: true
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
