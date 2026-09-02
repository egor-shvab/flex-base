import { rowsFrom } from '~~/prisma/seed/dataset/types'
import type { ISeedField, ISeedTable } from '~~/prisma/seed/dataset/types'

/**
 * The studio's own team and every client-side contact, in one table — which is how a small
 * agency actually keeps them, and what gives `Client` a relation that is legitimately blank for
 * a third of the rows.
 *
 * `Email` is optional and blank for five people **on purpose**: `Projects.Team` labels its links
 * by this field, so those links render with no label at all. That is a real state
 * (`buildRecordLabel` returns `null`) which nothing else in the dataset would reach.
 */

const FIELDS: ISeedField[] = [
  { name: 'Full name', type: 'TEXT', required: true, indexed: true },
  { name: 'Email', type: 'TEXT' },
  { name: 'Phone', type: 'TEXT' },
  { name: 'Client', type: 'RELATION', target: 'clients', labelField: 'Company name' },
  {
    name: 'Role',
    type: 'SELECT',
    choices: [
      { value: 'Owner', color: 'purple' },
      { value: 'CTO', color: 'indigo' },
      { value: 'Product manager', color: 'blue' },
      { value: 'Designer', color: 'pink' },
      { value: 'Developer', color: 'teal' },
      { value: 'Finance', color: 'gray' },
      { value: 'Marketing', color: 'orange' },
      { value: 'Operations', color: 'yellow' },
    ],
  },
  {
    name: 'Skills',
    type: 'SELECT',
    multiple: true,
    choices: [
      { value: 'Vue', color: 'green' },
      { value: 'Node', color: 'teal' },
      { value: 'Figma', color: 'pink' },
      { value: 'Copywriting', color: 'orange' },
      { value: 'SEO', color: 'yellow' },
      { value: 'QA', color: 'indigo' },
      { value: 'DevOps', color: 'gray' },
      { value: 'Accessibility', color: 'blue' },
    ],
  },
  { name: 'Internal', type: 'BOOLEAN' },
  { name: 'Joined', type: 'DATE' },
]

// prettier-ignore
export const PEOPLE: ISeedTable = {
  key: 'people',
  name: 'People',
  fields: FIELDS,
  records: rowsFrom(FIELDS, [
    // ref, full name, email, phone, client, role, skills, internal, joined

    // The studio
    ['people:ana', 'Ana Ferreira', 'ana@brightfold.studio', '+351 912 004 118', null, 'Owner', ['Figma', 'Copywriting'], true, '2018-02-01'],
    ['people:tom', 'Tom Whitlock', 'tom@brightfold.studio', '+44 7700 900412', null, 'CTO', ['Vue', 'Node', 'DevOps'], true, '2018-02-01'],
    ['people:mira', 'Mira Oyelaran', 'mira@brightfold.studio', null, null, 'Designer', ['Figma', 'Accessibility'], true, '2019-06-17'],
    ['people:jonas', 'Jonas Bergqvist', 'jonas@brightfold.studio', null, null, 'Developer', ['Vue', 'Node', 'QA'], true, '2020-01-13'],
    ['people:sofia', 'Sofia Marchetti', 'sofia@brightfold.studio', '+39 340 118 2276', null, 'Product manager', ['Copywriting', 'SEO'], true, '2020-09-07'],
    ['people:desmond', 'Desmond Kwan', 'desmond@brightfold.studio', null, null, 'Developer', ['Vue', 'QA', 'Accessibility'], true, '2021-03-22'],
    ['people:elin', 'Elin Haugen', 'elin@brightfold.studio', '+47 918 44 002', null, 'Marketing', ['Copywriting', 'SEO'], true, '2021-11-08'],
    ['people:rafael', 'Rafael Duarte', null, '+351 933 776 210', null, 'Developer', ['Node', 'DevOps'], true, '2022-05-30'],
    ['people:hana', 'Hana Kobayashi', 'hana@brightfold.studio', null, null, 'Designer', ['Figma'], true, '2023-02-06'],
    ['people:oscar', 'Oscar Lindqvist', 'oscar@brightfold.studio', null, null, 'Operations', [], true, '2023-10-02'],
    ['people:nadia', 'Nadia Belkacem', null, null, null, 'Finance', [], true, '2024-04-15'],
    ['people:pieter', 'Pieter Vos', 'pieter@brightfold.studio', '+31 6 1122 8890', null, 'Developer', ['Vue', 'Node'], true, '2025-01-20'],

    // Client-side contacts
    ['people:marieke', 'Marieke de Vries', 'marieke.devries@kestrel-logistics.nl', '+31 6 4455 1200', 'clients:kestrel', 'Operations', [], false, '2020-03-16'],
    ['people:joost', 'Joost Bakker', 'joost.bakker@kestrel-logistics.nl', null, 'clients:kestrel', 'Finance', [], false, '2021-01-11'],
    ['people:katrin', 'Katrin Vogel', 'k.vogel@helios-energy.de', '+49 151 2233 4455', 'clients:helios', 'CTO', [], false, '2021-09-02'],
    ['people:lukas', 'Lukas Brandt', 'l.brandt@helios-energy.de', null, 'clients:helios', 'Product manager', [], false, '2022-03-14'],
    ['people:ines', 'Inês Cardoso', 'ines@northwind-ceramics.pt', '+351 916 220 447', 'clients:northwind', 'Owner', [], false, '2023-04-11'],
    ['people:tiago', 'Tiago Melo', null, null, 'clients:northwind', 'Marketing', [], false, null],
    ['people:camille', 'Camille Roux', 'camille@maisonceleste.fr', '+33 6 12 44 88 01', 'clients:maison', 'Owner', [], false, '2024-06-18'],
    ['people:aoife', 'Aoife Byrne', 'aoife.byrne@brightpath.ie', '+353 86 220 4471', 'clients:brightpath', 'Product manager', [], false, '2022-11-07'],
    ['people:declan', 'Declan Moore', 'declan.moore@brightpath.ie', null, 'clients:brightpath', 'Finance', [], false, '2023-05-19'],
    ['people:pilar', 'Pilar Navarro', 'pilar.navarro@vitalia.es', '+34 611 220 774', 'clients:vitalia', 'Operations', [], false, '2023-01-23'],
    ['people:sergio', 'Sergio Ibáñez', null, null, 'clients:vitalia', 'CTO', [], false, '2024-02-27'],
    ['people:harold', 'Harold Pike', 'h.pike@oakmoor.co.uk', null, 'clients:oakmoor', 'Owner', [], false, '2019-08-05'],
    ['people:kaidi', 'Kaidi Tamm', 'kaidi@lumen-analytics.eu', '+372 5620 4411', 'clients:lumen', 'CTO', [], false, '2024-02-12'],
    ['people:mart', 'Mart Saar', 'mart@lumen-analytics.eu', null, 'clients:lumen', 'Developer', [], false, null],
    ['people:wojciech', 'Wojciech Zieliński', 'wojciech@tessera.studio', null, 'clients:tessera', 'Owner', [], false, '2025-01-09'],
    ['people:emre', 'Emre Yıldız', 'emre.yildiz@atlasfreight.com.tr', '+90 532 220 1144', 'clients:atlas', 'Operations', [], false, '2021-05-27'],
    ['people:selin', 'Selin Demir', 'selin.demir@atlasfreight.com.tr', null, 'clients:atlas', 'Finance', [], false, '2022-09-13'],
    ['people:grace', 'Grace Wanjiru', 'grace@verdant.org', '+254 720 114 882', 'clients:verdant', 'Owner', [], false, '2022-07-14'],
    ['people:annika', 'Annika Stenberg', 'annika.stenberg@cobaltretail.se', null, 'clients:cobalt', 'Marketing', [], false, '2018-10-01'],
    ['people:lucia', 'Lucía Ramírez', 'lucia.ramirez@marisolhoteles.mx', '+52 55 4411 2200', 'clients:marisol', 'Marketing', [], false, '2023-09-30'],
    ['people:javier', 'Javier Ortiz', null, null, 'clients:marisol', 'Operations', [], false, null],
    ['people:eleanor', 'Eleanor Shaw', 'eleanor.shaw@quillpublishing.ca', '+1 416 555 0182', 'clients:quill', 'Owner', [], false, '2024-11-04'],
    ['people:matthias', 'Matthias Roth', 'm.roth@sable-medical.ch', '+41 79 220 4411', 'clients:sable', 'CTO', [], false, '2020-12-08'],
    ['people:celine', 'Céline Girard', 'celine.girard@sable-medical.ch', null, 'clients:sable', 'Product manager', [], false, '2021-06-24'],
    ['people:rhys', 'Rhys Palmer', 'rhys@fernhill.co.uk', null, 'clients:fernhill', 'Owner', [], false, '2025-03-21'],
    ['people:veikko', 'Veikko Nieminen', 'veikko@arcadiagames.fi', '+358 40 220 1147', 'clients:arcadia', 'Product manager', [], false, '2022-04-19'],
    ['people:saara', 'Saara Koskinen', 'saara@arcadiagames.fi', null, 'clients:arcadia', 'Designer', [], false, '2023-03-02'],
    ['people:giulia', 'Giulia Ferrari', 'g.ferrari@deltarail.it', null, 'clients:delta', 'Operations', [], false, '2019-06-11'],
    ['people:orla', 'Orla Cassidy', 'orla@novenacare.ie', '+353 87 442 1180', 'clients:novena', 'Owner', [], false, '2025-05-06'],
    ['people:mads', 'Mads Sørensen', 'mads@bluecrest.dk', null, 'clients:bluecrest', 'CTO', [], false, '2023-08-15'],
    ['people:rita', 'Rita Lopes', 'rita.lopes@sunfold.pt', '+351 962 118 004', 'clients:sunfold', 'Finance', [], false, '2021-02-03'],
    ['people:sindre', 'Sindre Aas', 'sindre@harbourlight.no', null, 'clients:harbourlight', 'Product manager', [], false, '2024-09-24'],
    ['people:felix', 'Felix Gruber', 'felix.gruber@pinegrove.at', '+43 664 220 4411', 'clients:pinegrove', 'Owner', [], false, '2025-06-30'],
    ['people:dimitra', 'Dimitra Antoniou', 'd.antoniou@westbayresorts.gr', null, 'clients:westbay', 'Marketing', [], false, '2022-01-17'],
  ]),
}
