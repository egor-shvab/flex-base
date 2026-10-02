import { CLIENTS } from '~~/prisma/seed/dataset/clients'
import { EQUIPMENT } from '~~/prisma/seed/dataset/equipment'
import { IDEAS } from '~~/prisma/seed/dataset/ideas'
import { INVOICES } from '~~/prisma/seed/dataset/invoices'
import { PEOPLE } from '~~/prisma/seed/dataset/people'
import { PROJECTS } from '~~/prisma/seed/dataset/projects'
import { READING_LIST } from '~~/prisma/seed/dataset/reading-list'
import { TASKS } from '~~/prisma/seed/dataset/tasks'
import type { ISeedTable } from '~~/prisma/seed/dataset/types'

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
