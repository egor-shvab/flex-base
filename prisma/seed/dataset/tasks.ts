import { createRandom, pickFrom, pickInt, sampleFrom } from '~~/prisma/seed/random'
import { PEOPLE } from '~~/prisma/seed/dataset/people'
import { PROJECTS } from '~~/prisma/seed/dataset/projects'
import { rowsFrom } from '~~/prisma/seed/dataset/types'
import type { ISeedField, ISeedTable, TSeedRow } from '~~/prisma/seed/dataset/types'

/**
 * The list view's workhorse, and the only table with a **self-relation**: `Blocked by` targets
 * Tasks itself, which is legal (`requireFieldTarget` only asks that the target belongs to the
 * same user) and which nothing else in the dataset would exercise.
 *
 * Sized against two constants rather than by feel. At `RECORD_PAGE_SIZE` (50) this is five pages,
 * so paging, deep sorts and a search that spans pages all have somewhere to go; and it is the one
 * table past `RELATION_OPTIONS_LIMIT` (200), so its own picker shows a truncated candidate list.
 *
 * Composed from pools rather than written out: two hundred hand-written titles read no better
 * than sixty recombined, and the recombination is seeded, so a run is reproducible.
 */

const TASK_COUNT = 212

const FIELDS: ISeedField[] = [
  { name: 'Title', type: 'TEXT', required: true },
  { name: 'Project', type: 'RELATION', target: 'projects', labelField: 'Title' },
  { name: 'Assignee', type: 'RELATION', target: 'people', labelField: 'Full name' },
  { name: 'Blocked by', type: 'RELATION', target: 'tasks', labelField: 'Title', multiple: true },
  {
    name: 'Status',
    type: 'SELECT',
    indexed: true,
    choices: [
      { value: 'Backlog', color: 'gray' },
      { value: 'In progress', color: 'blue' },
      { value: 'In review', color: 'purple' },
      { value: 'Blocked', color: 'red' },
      { value: 'Done', color: 'green' },
    ],
  },
  {
    name: 'Priority',
    type: 'SELECT',
    choices: [
      { value: 'Low', color: 'gray' },
      { value: 'Normal', color: 'blue' },
      { value: 'High', color: 'orange' },
      { value: 'Urgent', color: 'red' },
    ],
  },
  {
    name: 'Labels',
    type: 'SELECT',
    multiple: true,
    choices: [
      { value: 'bug', color: 'red' },
      { value: 'chore', color: 'gray' },
      { value: 'design', color: 'pink' },
      { value: 'docs', color: 'blue' },
      { value: 'infra', color: 'indigo' },
      { value: 'research', color: 'purple' },
    ],
  },
  { name: 'Estimate (h)', type: 'NUMBER' },
  { name: 'Due', type: 'DATE' },
  { name: 'Done', type: 'BOOLEAN' },
]

// prettier-ignore
const ACTIONS = [
  'Wire up', 'Design', 'Rebuild', 'Fix',
  'Review', 'Document', 'Migrate', 'Refactor',
  'Test', 'Spec out', 'Prototype', 'Audit',
  'Estimate', 'Chase', 'Rewrite', 'Instrument',
  'Cache', 'Localise', 'Optimise', 'Retire',
  'Draft', 'Sign off', 'Import', 'Export',
  'Debug', 'Schedule', 'Restore', 'Simplify',
]

// prettier-ignore
const SUBJECTS = [
  'the checkout flow', 'the availability calendar', 'the invoice PDF',
  'the search filters', 'the empty states', 'the onboarding emails',
  'the error pages', 'the admin table', 'the mobile navigation',
  'the date picker', 'the export job', 'the login form',
  'the password reset', 'the file uploader', 'the audit log',
  'the reporting query', 'the print stylesheet', 'the cookie banner',
  'the sitemap', 'the image pipeline', 'the staging deploy',
  'the smoke tests', 'the keyboard focus order', 'the colour tokens',
  'the changelog', 'the sample data', 'the rate limiter',
  'the webhook receiver', 'the timezone handling', 'the currency formatting',
  'the pagination controls', 'the breadcrumb trail', 'the notification badges',
  'the CSV import', 'the session cookie', 'the analytics events',
  'the contact form', 'the FAQ page', 'the pricing table',
  'the accessibility statement',
]

const STATUSES = ['Backlog', 'In progress', 'In review', 'Blocked', 'Done']
const PRIORITIES = ['Low', 'Normal', 'High', 'Urgent']
const LABELS = ['bug', 'chore', 'design', 'docs', 'infra', 'research']

/** Realistic half-days and days. `0` and `null` are placed by hand below, not drawn from here. */
const ESTIMATES = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24]

const DUE_WINDOW_START = Date.UTC(2026, 5, 1)
const DUE_WINDOW_DAYS = 270
const DAY_MS = 24 * 60 * 60 * 1000

const PROJECT_REFS = PROJECTS.records.map((record) => record.ref)

/** Work is assigned to the studio, never to a client contact — hence the `Internal` filter. */
const ASSIGNEE_REFS = PEOPLE.records
  .filter((record) => record.values.Internal === true)
  .map((record) => record.ref)

function buildRows(): TSeedRow[] {
  const random = createRandom(0x5eed7a5c)
  const rows: TSeedRow[] = []
  const refs: string[] = []

  for (let index = 0; index < TASK_COUNT; index += 1) {
    const ref = `tasks:${index + 1}`
    const status = pickFrom(random, STATUSES)

    // Only a task that already has something before it can be blocked by one, which is also what
    // keeps every link pointing at a record the writer has an id for
    const blockedBy =
      refs.length > 0 && random() < 0.12 ? sampleFrom(random, refs, pickInt(random, 1, 2)) : []

    const dueDay = random() < 0.55 ? pickInt(random, 0, DUE_WINDOW_DAYS) : null
    const due = dueDay === null ? null : new Date(DUE_WINDOW_START + dueDay * DAY_MS)

    rows.push([
      ref,
      `${pickFrom(random, ACTIONS)} ${pickFrom(random, SUBJECTS)}`,
      pickFrom(random, PROJECT_REFS),
      // A fifth of the backlog is unassigned, which is what a blank single relation looks like
      random() < 0.2 ? null : pickFrom(random, ASSIGNEE_REFS),
      blockedBy,
      status,
      pickFrom(random, PRIORITIES),
      random() < 0.35 ? [] : sampleFrom(random, LABELS, pickInt(random, 1, 3)),
      // One of each edge the type allows: a zero estimate, and an unestimated task
      index === 42 ? 0 : random() < 0.1 ? null : pickFrom(random, ESTIMATES),
      due === null ? null : (due.toISOString().slice(0, 10) as string),
      status === 'Done',
    ])

    refs.push(ref)
  }

  return rows
}

export const TASKS: ISeedTable = {
  key: 'tasks',
  name: 'Tasks',
  fields: FIELDS,
  records: rowsFrom(FIELDS, buildRows()),
}
