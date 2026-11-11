import type { IUserRef } from '#shared/types/auth'
import type { IField } from '#shared/types/field'
import type { IRecordSort, TRecordFilterValues, TSortDirection } from '#shared/types/filter'
import type { ITable } from '#shared/types/table'

export type TRecordSingleValue = string | number | boolean | null

export type TRecordValue = TRecordSingleValue | string[]

export type TRecordData = Record<string, TRecordValue>

export interface IRecord {
  id: string
  number: number
  data: TRecordData
  createdAt: string
  updatedAt: string
}

/** Who wrote a record. Only the one-record read carries it; a list does not join the users. */
export interface IRecordWithAuthors extends IRecord {
  createdBy: IUserRef | null
  updatedBy: IUserRef | null
}

export interface IRecordPage {
  records: IRecord[]
  total: number
  totalCapped: boolean
  page: number
  pageSize: number
  linkedRecords: Record<string, Record<string, ILinkedRecord>>
}

export interface ILinkedRecord {
  number: number
  label: string | null
}

export interface IRecordOption extends ILinkedRecord {
  id: string
}

export interface IOpenRecord {
  tableAddress: string
  recordAddress: string
}

export interface IRecordDetail {
  table: Pick<ITable, 'id' | 'number' | 'name'>
  fields: IField[]
  record: IRecordWithAuthors
  linkedRecords: Record<string, Record<string, ILinkedRecord>>
}

export interface IRecordQueryState {
  page: number
  sort: IRecordSort
  filters: TRecordFilterValues
  search: string
}

export interface IRecordQuery extends IRecordQueryState {
  pageSize: number
}

export interface IRecordQueryParams extends Record<string, unknown> {
  page: number
  pageSize: number
  sort?: string
  dir: TSortDirection
  search?: string
}
