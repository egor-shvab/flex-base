import { rowsFrom } from '~~/prisma/seed/dataset/types'
import type { ISeedField, ISeedTable } from '~~/prisma/seed/dataset/types'

/**
 * A personal table alongside the business ones, because that is what people actually keep here —
 * and because it is the one table small enough to fit on screen whole, which makes it the place
 * to see a list view that never paginates.
 *
 * `Rating` and `Finished on` are blank on everything not yet read: two nullable columns whose
 * blanks line up with a third column's value, which is what makes a combined filter worth trying.
 */

const FIELDS: ISeedField[] = [
  { name: 'Title', type: 'TEXT', required: true },
  { name: 'Author', type: 'TEXT' },
  {
    name: 'Status',
    type: 'SELECT',
    choices: [
      { value: 'Want to read', color: 'gray' },
      { value: 'Reading', color: 'blue' },
      { value: 'Finished', color: 'green' },
      { value: 'Abandoned', color: 'red' },
    ],
  },
  { name: 'Rating', type: 'NUMBER' },
  { name: 'Finished on', type: 'DATE' },
  {
    name: 'Genres',
    type: 'SELECT',
    multiple: true,
    choices: [
      { value: 'Business', color: 'indigo' },
      { value: 'Design', color: 'pink' },
      { value: 'Fiction', color: 'purple' },
      { value: 'History', color: 'orange' },
      { value: 'Science', color: 'teal' },
      { value: 'Essays', color: 'yellow' },
    ],
  },
  { name: 'Owned', type: 'BOOLEAN' },
  { name: 'Notes', type: 'TEXT' },
]

// prettier-ignore
export const READING_LIST: ISeedTable = {
  key: 'reading',
  name: 'Reading list',
  fields: FIELDS,
  records: rowsFrom(FIELDS, [
    // ref, title, author, status, rating, finished on, genres, owned, notes
    ['reading:design-everyday', 'The Design of Everyday Things', 'Don Norman', 'Finished', 5, '2025-11-14', ['Design'], true, 'The affordances chapter is the one worth rereading.'],
    ['reading:shape-up', 'Shape Up', 'Ryan Singer', 'Finished', 4, '2026-01-08', ['Business', 'Design'], false, 'Six-week cycles will not fit our retainers, appetite-setting might.'],
    ['reading:thinking-fast', 'Thinking, Fast and Slow', 'Daniel Kahneman', 'Abandoned', 2, null, ['Science', 'Essays'], true, 'Stalled around page two hundred.'],
    ['reading:refactoring', 'Refactoring', 'Martin Fowler', 'Finished', 5, '2025-09-27', [], true, null],
    ['reading:making-things', 'Making Things Happen', 'Scott Berkun', 'Reading', null, null, ['Business'], true, null],
    ['reading:sea-of-tranquility', 'Sea of Tranquility', 'Emily St. John Mandel', 'Finished', 4, '2026-03-22', ['Fiction'], false, null],
    ['reading:atomic-design', 'Atomic Design', 'Brad Frost', 'Finished', 3, '2025-10-05', ['Design'], false, 'Useful vocabulary, dated examples.'],
    ['reading:accessibility-handbook', 'The Accessibility Handbook', 'Katie Cunningham', 'Reading', null, null, ['Design', 'Business'], true, 'Reading alongside the Sable compliance work.'],
    ['reading:seeing-like-state', 'Seeing Like a State', 'James C. Scott', 'Want to read', null, null, ['History', 'Essays'], false, null],
    ['reading:elements-typographic', 'The Elements of Typographic Style', 'Robert Bringhurst', 'Want to read', null, null, ['Design'], true, null],
    ['reading:soul-new-machine', 'The Soul of a New Machine', 'Tracy Kidder', 'Finished', 5, '2026-05-30', ['History', 'Science'], true, 'Best thing read all year.'],
    ['reading:piranesi', 'Piranesi', 'Susanna Clarke', 'Finished', 4, '2026-07-19', ['Fiction'], false, null],
    ['reading:working-effectively', 'Working Effectively with Legacy Code', 'Michael Feathers', 'Want to read', null, null, [], false, 'Bought for the Cobalt post-mortem that never happened.'],
    ['reading:invisible-women', 'Invisible Women', 'Caroline Criado Perez', 'Reading', null, null, ['Science', 'Essays'], true, null],
  ]),
}
