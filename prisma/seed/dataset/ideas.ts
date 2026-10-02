import type { ISeedField, ISeedTable } from '~~/prisma/seed/dataset/types'

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
