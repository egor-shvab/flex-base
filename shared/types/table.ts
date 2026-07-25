export interface ITable {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

/** List/dashboard shape — includes metadata counts for the table cards. */
export interface ITableListItem extends ITable {
  _count: {
    fields: number
    records: number
  }
}
