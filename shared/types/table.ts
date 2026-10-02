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
    records: number
  }
}
