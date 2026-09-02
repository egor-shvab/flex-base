export interface ITable {
  id: string
  /**
   * The id a user reads — sequential within its owner's tables, unlike `id`, which is a cuid
   * because it is what a relation's `targetTableId` references.
   */
  number: number
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
