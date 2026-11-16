export interface ITable {
  id: string
  number: number
  name: string
  createdAt: string
  updatedAt: string
}

export interface ITableListItem extends ITable {
  _count: {
    fields: number
    /** `null` where the caller reads only some of the records: the count would reveal the rest. */
    records: number | null
  }
}
