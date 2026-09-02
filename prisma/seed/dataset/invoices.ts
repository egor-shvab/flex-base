import { createRandom, pickInt } from '~~/prisma/seed/random'
import { CLIENTS } from '~~/prisma/seed/dataset/clients'
import { PROJECTS } from '~~/prisma/seed/dataset/projects'
import { rowsFrom } from '~~/prisma/seed/dataset/types'
import type { ISeedField, ISeedTable, TSeedRow } from '~~/prisma/seed/dataset/types'

/**
 * The billing ledger. Two things here are not decoration:
 *
 * `Paid on` is blank on every unpaid invoice — roughly two in five — which is the dataset's main
 * source of NULLs in a sortable column, and therefore the only place `NULLS LAST` is visible in
 * both directions.
 *
 * `Amount` carries the numeric edges a NUMBER field allows and a currency column usually hides: a
 * credit note is negative, one line is exactly zero, and every other value has real cents.
 */

const INVOICE_COUNT = 96

const FIELDS: ISeedField[] = [
  { name: 'Reference', type: 'TEXT', indexed: true },
  {
    name: 'Client',
    type: 'RELATION',
    required: true,
    target: 'clients',
    labelField: 'Company name',
  },
  { name: 'Project', type: 'RELATION', target: 'projects', labelField: 'Title' },
  { name: 'Amount', type: 'NUMBER', indexed: true },
  {
    name: 'Currency',
    type: 'SELECT',
    choices: [
      { value: 'EUR', color: 'blue' },
      { value: 'USD', color: 'green' },
      { value: 'GBP', color: 'purple' },
    ],
  },
  { name: 'Issued on', type: 'DATE', indexed: true },
  { name: 'Paid on', type: 'DATE' },
  { name: 'Paid', type: 'BOOLEAN' },
  { name: 'Notes', type: 'TEXT' },
]

const ISSUE_WINDOW_START = Date.UTC(2025, 8, 1)
const ISSUE_WINDOW_DAYS = 360
const DAY_MS = 24 * 60 * 60 * 1000

const COUNTRY_CURRENCY: Record<string, string> = {
  'United Kingdom': 'GBP',
  Canada: 'USD',
  Kenya: 'USD',
  México: 'USD',
}

const COUNTRY_BY_CLIENT = new Map(
  CLIENTS.records.map((record) => [record.ref, String(record.values.Country ?? '')]),
)

/** Only a project that was actually worked on gets billed, so the cancelled ones are left out. */
const BILLABLE_PROJECTS = PROJECTS.records.filter(
  (record) => record.values.Status !== 'Cancelled' && record.values.Billable === true,
)

const NOTES = [
  'Split across two cost centres at their request.',
  'Second reminder sent.',
  'Includes the out-of-scope reporting screen.',
  'Deposit invoice; balance follows on delivery.',
]

const CREDIT_NOTE = 'Credit note against the duplicate line on the previous invoice.'

const isoDay = (milliseconds: number) => new Date(milliseconds).toISOString().slice(0, 10)

function buildRows(): TSeedRow[] {
  const random = createRandom(0x1b0a5ce3)
  const rows: TSeedRow[] = []

  for (let index = 0; index < INVOICE_COUNT; index += 1) {
    const project = BILLABLE_PROJECTS[index % BILLABLE_PROJECTS.length]
    if (project === undefined) throw new Error('No billable projects to invoice against')

    const clientRef = String(project.values.Client)
    const issuedOn = ISSUE_WINDOW_START + pickInt(random, 0, ISSUE_WINDOW_DAYS) * DAY_MS

    // Two in five are still outstanding, and an unpaid invoice has no payment date — which is
    // what puts a real spread of NULLs into a sortable, filterable column
    const paid = random() < 0.6
    const paidOn = paid ? issuedOn + pickInt(random, 8, 75) * DAY_MS : null

    const amount = Number((pickInt(random, 45000, 2_400_000) / 100).toFixed(2))

    rows.push([
      `invoices:${index + 1}`,
      `INV-${new Date(issuedOn).getUTCFullYear()}-${String(index + 1).padStart(4, '0')}`,
      clientRef,
      // A handful are general retainer lines with no project behind them
      random() < 0.12 ? null : project.ref,
      // One credit note and one nil-value line, so the column is not uniformly positive
      index === 17 ? -1840.5 : index === 61 ? 0 : amount,
      COUNTRY_CURRENCY[COUNTRY_BY_CLIENT.get(clientRef) ?? ''] ?? 'EUR',
      isoDay(issuedOn),
      paidOn === null ? null : isoDay(paidOn),
      paid,
      index === 17 ? CREDIT_NOTE : random() < 0.12 ? (NOTES[pickInt(random, 0, 3)] ?? null) : null,
    ])
  }

  return rows
}

export const INVOICES: ISeedTable = {
  key: 'invoices',
  name: 'Invoices',
  fields: FIELDS,
  records: rowsFrom(FIELDS, buildRows()),
}
