import { rowsFrom } from '~~/prisma/seed/dataset/types'
import type { ISeedField, ISeedTable } from '~~/prisma/seed/dataset/types'

/**
 * One record, on purpose.
 *
 * A list holding a single row is its own UI state — no pagination, one row against the header,
 * and a relation picker whose candidate list is longer than the table it sits in. Nothing else in
 * the dataset reaches it, and it is the state a real account spends its first week in.
 */

const FIELDS: ISeedField[] = [
  { name: 'Item', type: 'TEXT', required: true },
  {
    name: 'Category',
    type: 'SELECT',
    choices: [
      { value: 'Laptop', color: 'blue' },
      { value: 'Display', color: 'teal' },
      { value: 'Phone', color: 'purple' },
      { value: 'Furniture', color: 'orange' },
      { value: 'Other', color: 'gray' },
    ],
  },
  { name: 'Purchased', type: 'DATE' },
  { name: 'Cost', type: 'NUMBER' },
  { name: 'Assigned to', type: 'RELATION', target: 'people', labelField: 'Full name' },
  { name: 'Warranty until', type: 'DATE' },
  { name: 'In service', type: 'BOOLEAN' },
]

// prettier-ignore
export const EQUIPMENT: ISeedTable = {
  key: 'equipment',
  name: 'Office equipment',
  fields: FIELDS,
  records: rowsFrom(FIELDS, [
    // ref, item, category, purchased, cost, assigned to, warranty until, in service
    ['equipment:studio-plotter', 'Large-format plotter', 'Other', '2024-10-02', 3480.75, 'people:oscar', null, true],
  ]),
}
