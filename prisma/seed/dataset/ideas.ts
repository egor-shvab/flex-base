import type { ISeedField, ISeedTable } from '~~/prisma/seed/dataset/types'

/**
 * Fields but no records, on purpose.
 *
 * A table someone has configured and not yet filled is the first thing every new table is, and
 * its empty state is a distinct surface — `role="status"` copy rather than an empty grid, and a
 * settings page that is fully usable with nothing behind it. No other table here can show it.
 */

const FIELDS: ISeedField[] = [
  { name: 'Title', type: 'TEXT', required: true },
  {
    name: 'Area',
    type: 'SELECT',
    choices: [
      { value: 'Service', color: 'blue' },
      { value: 'Tooling', color: 'teal' },
      { value: 'Marketing', color: 'orange' },
      { value: 'Hiring', color: 'purple' },
    ],
  },
  {
    name: 'Effort',
    type: 'SELECT',
    choices: [
      { value: 'An afternoon', color: 'green' },
      { value: 'A week', color: 'yellow' },
      { value: 'A quarter', color: 'red' },
    ],
  },
  { name: 'Sketched', type: 'DATE' },
  { name: 'Worth doing', type: 'BOOLEAN' },
]

export const IDEAS: ISeedTable = {
  key: 'ideas',
  name: 'Ideas',
  fields: FIELDS,
  records: [],
}
