import { rowsFrom } from '~~/prisma/seed/dataset/types'
import type { ISeedField, ISeedTable } from '~~/prisma/seed/dataset/types'

/**
 * The engagements themselves — the table that carries both relation cardinalities at once: a
 * single required `Client`, and a `Team` holding up to five links.
 *
 * `Team` is labelled by People's `Email` rather than their name, which is what puts an
 * unlabelled link on screen for the few people who have no address on file.
 *
 * Due dates straddle 2026-09-01 deliberately: some are past, some ahead, several blank — so a
 * date range filter and a `NULLS LAST` sort both have something to separate.
 */

const FIELDS: ISeedField[] = [
  { name: 'Title', type: 'TEXT', required: true, indexed: true },
  {
    name: 'Client',
    type: 'RELATION',
    required: true,
    target: 'clients',
    labelField: 'Company name',
  },
  { name: 'Team', type: 'RELATION', target: 'people', labelField: 'Email', multiple: true },
  {
    name: 'Status',
    type: 'SELECT',
    indexed: true,
    choices: [
      { value: 'Planning', color: 'blue' },
      { value: 'Active', color: 'green' },
      { value: 'On hold', color: 'yellow' },
      { value: 'Delivered', color: 'teal' },
      { value: 'Cancelled', color: 'red' },
    ],
  },
  {
    name: 'Services',
    type: 'SELECT',
    multiple: true,
    choices: [
      { value: 'Discovery', color: 'indigo' },
      { value: 'UX design', color: 'purple' },
      { value: 'UI design', color: 'pink' },
      { value: 'Frontend', color: 'green' },
      { value: 'Backend', color: 'teal' },
      { value: 'Integrations', color: 'gray' },
      { value: 'Support', color: 'orange' },
      { value: 'SEO', color: 'yellow' },
    ],
  },
  { name: 'Budget', type: 'NUMBER', indexed: true },
  { name: 'Start date', type: 'DATE', indexed: true },
  { name: 'Due date', type: 'DATE' },
  { name: 'Billable', type: 'BOOLEAN' },
  { name: 'Brief', type: 'TEXT' },
]

// prettier-ignore
export const PROJECTS: ISeedTable = {
  key: 'projects',
  name: 'Projects',
  fields: FIELDS,
  records: rowsFrom(FIELDS, [
    // ref, title, client, team, status, services, budget, start date, due date, billable, brief
    ['projects:northwind-shop', 'Northwind online shop', 'clients:northwind', ['people:ana', 'people:mira', 'people:jonas'], 'Delivered', ['Discovery', 'UX design', 'UI design', 'Frontend'], 42000, '2023-05-02', '2023-11-30', true, 'Replace the hand-built storefront with something the Aveiro team can update themselves.'],
    ['projects:northwind-catalogue', 'Northwind catalogue refresh', 'clients:northwind', ['people:mira', 'people:hana'], 'Active', ['UI design'], 12500, '2026-03-09', '2026-10-16', true, null],
    ['projects:helios-portal', 'Helios supplier portal', 'clients:helios', ['people:tom', 'people:jonas', 'people:pieter', 'people:rafael'], 'Active', ['Discovery', 'Frontend', 'Backend', 'Integrations'], 168000, '2025-10-06', '2026-12-18', true, 'Suppliers submit certificates, delivery notes and invoices through three different inboxes today. One portal, one audit trail, and a read-only view for the compliance team.'],
    ['projects:helios-audit', 'Helios accessibility audit', 'clients:helios', ['people:mira', 'people:desmond'], 'Delivered', ['Discovery'], 9500, '2026-01-12', '2026-02-27', true, 'WCAG 2.2 AA pass over the public site and the supplier login.'],
    ['projects:helios-sso', 'Helios single sign-on', 'clients:helios', ['people:tom', 'people:rafael'], 'On hold', ['Backend', 'Integrations'], 31000, '2026-04-20', null, true, 'Paused until their identity provider migration lands.'],
    ['projects:maison-site', 'Maison Céleste site', 'clients:maison', ['people:hana', 'people:sofia'], 'Delivered', ['UI design', 'Frontend', 'Support'], 15500, '2024-07-01', '2024-10-11', true, null],
    ['projects:brightpath-lms', 'Brightpath course platform', 'clients:brightpath', ['people:tom', 'people:jonas', 'people:desmond', 'people:sofia'], 'Active', ['Discovery', 'UX design', 'Frontend', 'Backend'], 72000, '2025-11-03', '2026-09-30', true, 'Course authoring, enrolment and a tutor dashboard. Reporting is explicitly out of scope for the first release.'],
    ['projects:brightpath-brand', 'Brightpath brand system', 'clients:brightpath', ['people:ana', 'people:mira'], 'Delivered', ['UI design'], 18000, '2023-01-16', '2023-04-28', true, null],
    ['projects:kestrel-dashboard', 'Kestrel freight dashboard', 'clients:kestrel', ['people:tom', 'people:pieter', 'people:desmond'], 'Active', ['Discovery', 'UX design', 'Frontend', 'Backend', 'Integrations'], 96000, '2025-09-15', '2026-11-27', true, 'One screen for the Rotterdam desk covering live shipments, exceptions and the customs queue.'],
    ['projects:kestrel-customs', 'Kestrel customs integration', 'clients:kestrel', ['people:rafael', 'people:pieter'], 'Active', ['Backend', 'Integrations'], 54000, '2026-02-02', '2026-08-14', true, 'Ran past its date waiting on the Antwerp filing schema.'],
    ['projects:kestrel-retainer', 'Kestrel support retainer', 'clients:kestrel', ['people:oscar', 'people:rafael'], 'Active', ['Support'], 24000, '2024-01-08', null, true, null],
    ['projects:vitalia-booking', 'Vitalia appointment booking', 'clients:vitalia', ['people:jonas', 'people:hana', 'people:sofia'], 'Delivered', ['UX design', 'UI design', 'Frontend', 'Backend'], 61000, '2024-03-04', '2024-12-13', true, null],
    ['projects:vitalia-intranet', 'Vitalia staff intranet', 'clients:vitalia', ['people:pieter'], 'Planning', ['Discovery'], 28000, '2026-09-14', '2027-03-31', true, null],
    ['projects:oakmoor-brochure', 'Oakmoor brochure site', 'clients:oakmoor', ['people:hana'], 'Cancelled', ['UI design', 'Frontend'], 6800, '2019-09-02', null, true, 'Cancelled when the plant closed. Kept for the invoice trail.'],
    ['projects:lumen-marketing', 'Lumen marketing site', 'clients:lumen', ['people:mira', 'people:elin'], 'Delivered', ['UI design', 'Frontend', 'SEO'], 22000, '2024-03-11', '2024-06-21', true, null],
    ['projects:lumen-console', 'Lumen reporting console', 'clients:lumen', ['people:tom', 'people:jonas'], 'Active', ['UX design', 'Frontend', 'Backend'], 58000, '2025-12-01', '2026-10-30', true, null],
    ['projects:tessera-handoff', 'Tessera design handoff', 'clients:tessera', ['people:mira'], 'Delivered', ['UI design'], 8500, '2025-02-03', '2025-04-18', true, null],
    ['projects:tessera-audit', 'Tessera performance review', 'clients:tessera', ['people:desmond'], 'Planning', ['Discovery'], 4200, '2026-10-05', null, true, null],
    ['projects:atlas-tracking', 'Atlas shipment tracking', 'clients:atlas', ['people:tom', 'people:rafael', 'people:pieter'], 'Active', ['Discovery', 'Frontend', 'Backend', 'Integrations'], 88000, '2025-10-20', '2026-09-25', true, 'Live tracking for the İzmir and Mersin corridors, with a public link customers can be sent.'],
    ['projects:atlas-mobile', 'Atlas driver app', 'clients:atlas', ['people:desmond', 'people:hana'], 'On hold', ['UX design', 'UI design'], 45000, '2026-01-19', null, true, 'Waiting on a decision about the handset fleet.'],
    ['projects:verdant-donations', 'Verdant donation flow', 'clients:verdant', ['people:jonas', 'people:sofia'], 'Delivered', ['UX design', 'Frontend', 'Backend'], 12000, '2022-08-15', '2022-12-02', false, 'Pro bono. Two-step giving flow with M-Pesa alongside cards.'],
    ['projects:verdant-report', 'Verdant annual report', 'clients:verdant', ['people:ana', 'people:elin'], 'Delivered', ['UI design'], 5400, '2025-01-13', '2025-03-07', false, null],
    ['projects:cobalt-replatform', 'Cobalt replatform', 'clients:cobalt', [], 'Cancelled', ['Discovery', 'Frontend', 'Backend'], 240000, '2018-11-05', null, true, 'Largest thing we ever scoped and never started.'],
    ['projects:marisol-booking', 'Marisol booking engine', 'clients:marisol', ['people:tom', 'people:jonas', 'people:pieter'], 'Active', ['Discovery', 'Frontend', 'Backend', 'Integrations'], 67000, '2025-09-08', '2026-10-09', true, null],
    ['projects:marisol-seo', 'Marisol search visibility', 'clients:marisol', ['people:elin'], 'Active', ['SEO'], 9000, '2026-05-04', '2026-11-13', true, null],
    ['projects:quill-store', 'Quill catalogue store', 'clients:quill', ['people:hana', 'people:jonas'], 'Active', ['UI design', 'Frontend', 'Backend'], 19500, '2025-01-06', '2026-07-31', true, 'Slipped twice on their side; the date is stale rather than at risk.'],
    ['projects:sable-records', 'Sable patient records UI', 'clients:sable', ['people:mira', 'people:desmond', 'people:tom', 'people:jonas'], 'Active', ['Discovery', 'UX design', 'UI design', 'Frontend'], 142000, '2025-09-22', '2027-01-29', true, 'The largest active engagement. Every screen goes through a clinical review before it ships, which is why the schedule looks slow against the budget.'],
    ['projects:sable-compliance', 'Sable compliance review', 'clients:sable', ['people:desmond', 'people:nadia'], 'Delivered', ['Discovery'], 21000, '2026-02-16', '2026-05-08', true, null],
    ['projects:sable-support', 'Sable maintenance retainer', 'clients:sable', ['people:oscar', 'people:rafael'], 'Active', ['Support'], 36000, '2024-06-03', null, true, null],
    ['projects:fernhill-site', 'Fernhill garden site', 'clients:fernhill', ['people:hana'], 'Planning', ['UI design', 'Frontend'], null, '2026-09-21', '2027-02-26', true, 'Budget still under discussion, so nothing is committed yet.'],
    ['projects:arcadia-launch', 'Arcadia launch campaign', 'clients:arcadia', ['people:elin', 'people:sofia', 'people:mira'], 'Delivered', ['UI design', 'SEO'], 34000, '2024-04-08', '2024-09-20', true, null],
    ['projects:arcadia-store', 'Arcadia merch store', 'clients:arcadia', ['people:jonas', 'people:pieter'], 'Active', ['Frontend', 'Backend', 'Integrations'], 50000, '2026-03-02', '2026-12-11', true, null],
    ['projects:delta-timetable', 'Delta timetable redesign', 'clients:delta', [], 'Cancelled', ['UX design'], 76000, '2019-07-15', null, true, null],
    ['projects:novena-site', 'Novena care site', 'clients:novena', ['people:hana', 'people:sofia'], 'Active', ['Discovery', 'UI design', 'Frontend'], 26000, '2025-05-19', '2026-09-18', true, null],
    ['projects:bluecrest-portal', 'Bluecrest client portal', 'clients:bluecrest', ['people:tom', 'people:pieter', 'people:desmond'], 'Active', ['UX design', 'Frontend', 'Backend'], 61000, '2025-09-01', '2026-10-23', true, null],
    ['projects:bluecrest-brand', 'Bluecrest identity', 'clients:bluecrest', ['people:ana', 'people:mira'], 'Delivered', ['UI design'], 16000, '2023-09-04', '2023-12-15', true, null],
    ['projects:sunfold-catalogue', 'Sunfold fabric catalogue', 'clients:sunfold', ['people:hana', 'people:jonas'], 'On hold', ['UI design', 'Frontend', 'Backend'], 43000, '2025-10-13', null, true, 'Paused over the outstanding invoices.'],
    ['projects:sunfold-erp', 'Sunfold ERP integration', 'clients:sunfold', ['people:rafael'], 'On hold', ['Integrations'], 34000, '2026-01-26', null, true, null],
    ['projects:harbourlight-grants', 'Harbourlight grants portal', 'clients:harbourlight', ['people:jonas', 'people:sofia', 'people:desmond'], 'Active', ['Discovery', 'UX design', 'Frontend', 'Backend'], 34000, '2025-10-27', '2026-09-11', true, null],
    ['projects:pinegrove-site', 'Pinegrove school site', 'clients:pinegrove', ['people:hana'], 'Active', ['UI design', 'Frontend'], 14200, '2026-07-06', '2026-11-20', true, null],
    ['projects:westbay-booking', 'Westbay resort booking', 'clients:westbay', ['people:tom', 'people:jonas', 'people:hana', 'people:pieter'], 'Active', ['Discovery', 'UX design', 'UI design', 'Frontend', 'Backend'], 121000, '2025-11-17', '2026-12-04', true, 'Six properties, one availability calendar, and a hard requirement that a booking survives a lost connection mid-flow.'],
    ['projects:westbay-loyalty', 'Westbay loyalty scheme', 'clients:westbay', ['people:pieter', 'people:sofia'], 'Planning', ['Discovery', 'Integrations'], 38000, '2026-10-12', '2027-05-14', true, null],
    ['projects:helios-datasheet', 'Helios datasheet generator', 'clients:helios', ['people:rafael', 'people:nadia'], 'Delivered', ['Backend'], 17500, '2024-09-02', '2025-01-24', true, null],
    ['projects:kestrel-scanner', 'Kestrel warehouse scanner', 'clients:kestrel', ['people:desmond', 'people:pieter'], 'Planning', ['Discovery', 'UX design'], 47000, '2026-09-28', '2027-04-16', true, null],
    ['projects:vitalia-forms', 'Vitalia intake forms', 'clients:vitalia', ['people:jonas'], 'Delivered', ['Frontend'], 11000, '2025-06-09', '2025-08-29', true, null],
    ['projects:atlas-portal', 'Atlas partner portal', 'clients:atlas', ['people:tom', 'people:jonas'], 'Delivered', ['Frontend', 'Backend'], 62000, '2023-02-06', '2023-10-20', true, null],
    ['projects:lumen-onboarding', 'Lumen onboarding flow', 'clients:lumen', ['people:mira', 'people:sofia'], 'Active', ['UX design', 'UI design'], 15000, '2026-06-15', '2026-10-02', true, null],
    ['projects:brightpath-support', 'Brightpath support retainer', 'clients:brightpath', ['people:oscar'], 'Active', ['Support'], 18000, '2024-02-05', null, true, null],
    ['projects:marisol-brand', 'Marisol brand refresh', 'clients:marisol', ['people:ana', 'people:mira', 'people:hana'], 'Delivered', ['UI design'], 23000, '2024-01-15', '2024-05-31', true, null],
    ['projects:quill-audit', 'Quill accessibility fixes', 'clients:quill', ['people:desmond'], 'Active', ['Discovery', 'Frontend'], 7600, '2026-06-01', '2026-08-21', true, null],
    ['projects:westbay-support', 'Westbay support retainer', 'clients:westbay', ['people:oscar', 'people:rafael'], 'Active', ['Support'], 30000, '2026-01-05', null, true, null],
    ['projects:verdant-volunteers', 'Verdant volunteer portal', 'clients:verdant', ['people:jonas', 'people:desmond'], 'Planning', ['Discovery', 'UX design'], 9800, '2026-11-02', null, false, null],
  ]),
}
