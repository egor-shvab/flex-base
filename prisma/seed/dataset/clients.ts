import { rowsFrom } from '~~/prisma/seed/dataset/types'
import type { ISeedField, ISeedTable } from '~~/prisma/seed/dataset/types'

/**
 * The studio's clients — the table two others link to, so it is created first.
 *
 * Its `Company name` is required, which makes it a label field that can never be blank; the
 * unlabelled-link case is covered by People's `Email` instead (see `people.ts`).
 */

/** One record near `TEXT_MAX_LENGTH`, so a cell has something real to truncate. */
const LONG_NOTE =
  'Kestrel came to us through the Helios introduction and has been the steadiest account on ' +
  'the books since. Three separate teams buy from us: the freight desk in Rotterdam, the ' +
  'customs group in Antwerp, and a small analytics unit that reports into the CFO and pays ' +
  'out of a different cost centre entirely. Invoices must be split accordingly or the whole ' +
  'batch is returned, which has happened twice and cost us the better part of a month each ' +
  'time. Their procurement window opens in the second week of January and closes hard at the ' +
  'end of February; anything proposed outside it waits a full year, whatever anyone says in ' +
  'the meantime. Marieke is the only person who can approve above forty thousand, so a quote ' +
  'that goes to her deputy is a quote that has not been sent. They read every accessibility ' +
  'report we produce and have twice asked for the underlying axe output, which is worth ' +
  'knowing before promising a summary. Renewal is annual and has never once been negotiated.'

const FIELDS: ISeedField[] = [
  { name: 'Company name', type: 'TEXT', required: true, indexed: true },
  {
    name: 'Industry',
    type: 'SELECT',
    choices: [
      { value: 'Software', color: 'blue' },
      { value: 'Retail', color: 'orange' },
      { value: 'Healthcare', color: 'teal' },
      { value: 'Education', color: 'indigo' },
      { value: 'Manufacturing', color: 'gray' },
      { value: 'Non-profit', color: 'green' },
      { value: 'Hospitality', color: 'pink' },
      { value: 'Logistics', color: 'yellow' },
    ],
  },
  {
    name: 'Segment',
    type: 'SELECT',
    choices: [
      { value: 'Enterprise', color: 'purple' },
      { value: 'Mid-market', color: 'blue' },
      { value: 'Small business', color: 'gray' },
    ],
  },
  { name: 'Country', type: 'TEXT' },
  { name: 'Website', type: 'TEXT' },
  { name: 'Client since', type: 'DATE', indexed: true },
  { name: 'Active', type: 'BOOLEAN' },
  { name: 'Annual budget', type: 'NUMBER', indexed: true },
  {
    name: 'Tags',
    type: 'SELECT',
    multiple: true,
    choices: [
      { value: 'Referral', color: 'green' },
      { value: 'Retainer', color: 'teal' },
      { value: 'Legacy', color: 'gray' },
      { value: 'At risk', color: 'red' },
      { value: 'Key account', color: 'purple' },
      { value: 'Slow payer', color: 'orange' },
    ],
  },
  { name: 'Notes', type: 'TEXT' },
]

// prettier-ignore
export const CLIENTS: ISeedTable = {
  key: 'clients',
  name: 'Clients',
  fields: FIELDS,
  records: rowsFrom(FIELDS, [
    // ref, company name, industry, segment, country, website, client since, active, annual budget, tags, notes
    ['clients:northwind', 'Northwind Ceramics', 'Retail', 'Mid-market', 'Portugal', 'https://northwind-ceramics.pt', '2023-04-11', true, 48000, ['Retainer', 'Key account'], 'Ships from Aveiro; product photography always runs late.'],
    ['clients:helios', 'Helios Energy', 'Manufacturing', 'Enterprise', 'Germany', 'https://helios-energy.de', '2021-09-02', true, 210000, ['Legacy', 'Key account'], null],
    ['clients:maison', 'Maison Céleste', 'Hospitality', 'Small business', 'France', null, '2024-06-18', true, 15500, ['Referral'], 'All copy is signed off in French first.'],
    ['clients:brightpath', 'Brightpath Learning', 'Education', 'Mid-market', 'Ireland', 'https://brightpath.ie', '2022-11-07', true, 72000, [], null],
    ['clients:kestrel', 'Kestrel Logistics', 'Logistics', 'Enterprise', 'Netherlands', 'https://kestrel-logistics.nl', '2020-03-16', true, 164000, ['Retainer', 'Legacy', 'Key account'], LONG_NOTE],
    ['clients:vitalia', 'Vitalia Clinics', 'Healthcare', 'Mid-market', 'Spain', 'https://vitalia.es', '2023-01-23', true, 96000, ['Retainer'], null],
    ['clients:oakmoor', 'Oakmoor & Sons', 'Manufacturing', 'Small business', 'United Kingdom', null, '2019-08-05', false, 0, ['Legacy', 'Slow payer'], 'Dormant since the Hartlepool plant closed.'],
    ['clients:lumen', 'Lumen Analytics', 'Software', 'Mid-market', 'Estonia', 'https://lumen-analytics.eu', '2024-02-12', true, 58000, ['Referral', 'Key account'], null],
    ['clients:tessera', 'Tessera Studio', 'Software', 'Small business', 'Poland', 'https://tessera.studio', '2025-01-09', true, 21000, [], null],
    ['clients:atlas', 'Atlas Freight', 'Logistics', 'Enterprise', 'Türkiye', 'https://atlasfreight.com.tr', '2021-05-27', true, 133000, ['Retainer'], null],
    ['clients:verdant', 'Verdant Foundation', 'Non-profit', 'Small business', 'Kenya', 'https://verdant.org', '2022-07-14', true, 12000, ['Referral', 'Retainer'], 'Grant-funded; budgets confirm each October.'],
    ['clients:cobalt', 'Cobalt Retail Group', 'Retail', 'Enterprise', 'Sweden', 'https://cobaltretail.se', '2018-10-01', false, 0, ['Legacy'], null],
    ['clients:marisol', 'Marisol Hoteles', 'Hospitality', 'Mid-market', 'México', 'https://marisolhoteles.mx', '2023-09-30', true, 67000, ['Key account'], null],
    ['clients:quill', 'Quill Publishing', 'Education', 'Small business', 'Canada', null, '2024-11-04', true, 19500, ['Slow payer'], 'Pays on 90-day terms, never sooner.'],
    ['clients:sable', 'Sable Medical', 'Healthcare', 'Enterprise', 'Switzerland', 'https://sable-medical.ch', '2020-12-08', true, 188000, ['Retainer', 'Key account'], null],
    ['clients:fernhill', 'Fernhill Garden Centres', 'Retail', 'Small business', 'United Kingdom', 'https://fernhill.co.uk', '2025-03-21', true, null, [], 'Budget still to be agreed for the first year.'],
    ['clients:arcadia', 'Arcadia Games', 'Software', 'Mid-market', 'Finland', 'https://arcadiagames.fi', '2022-04-19', true, 84000, ['Referral'], null],
    ['clients:delta', 'Delta Rail', 'Logistics', 'Enterprise', 'Italy', 'https://deltarail.it', '2019-06-11', false, 0, ['Legacy', 'At risk'], 'Contract lapsed; kept for the invoice history.'],
    ['clients:novena', 'Novena Care', 'Healthcare', 'Small business', 'Ireland', null, '2025-05-06', true, null, [], null],
    ['clients:bluecrest', 'Bluecrest Advisory', 'Software', 'Mid-market', 'Denmark', 'https://bluecrest.dk', '2023-08-15', true, 61000, ['Retainer'], null],
    ['clients:sunfold', 'Sunfold Textiles', 'Manufacturing', 'Mid-market', 'Portugal', 'https://sunfold.pt', '2021-02-03', true, 77000, ['At risk', 'Slow payer'], 'Two invoices outstanding past ninety days.'],
    ['clients:harbourlight', 'Harbourlight Trust', 'Non-profit', 'Mid-market', 'Norway', 'https://harbourlight.no', '2024-09-24', true, 34000, ['Referral'], null],
    ['clients:pinegrove', 'Pinegrove Academy', 'Education', 'Small business', 'Austria', 'https://pinegrove.at', '2025-06-30', true, 14200, [], null],
    ['clients:westbay', 'Westbay Resorts', 'Hospitality', 'Enterprise', 'Greece', 'https://westbayresorts.gr', '2022-01-17', true, 121000, ['Retainer', 'Key account'], null],
  ]),
}
