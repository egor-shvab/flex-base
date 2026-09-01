import { CLIENTS } from '~~/prisma/seed/dataset/clients'
import { EQUIPMENT } from '~~/prisma/seed/dataset/equipment'
import { IDEAS } from '~~/prisma/seed/dataset/ideas'
import { INVOICES } from '~~/prisma/seed/dataset/invoices'
import { PEOPLE } from '~~/prisma/seed/dataset/people'
import { PROJECTS } from '~~/prisma/seed/dataset/projects'
import { READING_LIST } from '~~/prisma/seed/dataset/reading-list'
import { TASKS } from '~~/prisma/seed/dataset/tasks'
import type { ISeedTable } from '~~/prisma/seed/dataset/types'

/**
 * The whole demo workspace, in the order it is written.
 *
 * **Order is the table numbering a user sees** (`Table.number` counts up per account), and it is
 * also the order the sidebar lists them in, so the tables a demo starts from come first. It does
 * *not* have to put a relation's target ahead of the table linking to it — every id is computed
 * before the first insert (`ids.ts`) — but keeping targets first makes the file readable as a
 * dependency order, and Tasks linking to itself shows why the writer cannot rely on one.
 */
export const SEED_TABLES: ISeedTable[] = [
  CLIENTS,
  PEOPLE,
  PROJECTS,
  TASKS,
  INVOICES,
  READING_LIST,
  EQUIPMENT,
  IDEAS,
]
