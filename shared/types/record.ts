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
