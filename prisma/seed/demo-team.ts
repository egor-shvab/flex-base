import { FULL_TABLE_ACCESS, WORKSPACE_PERMISSIONS } from '#shared/constants/workspace'
import type {
  ITableAccess,
  TFieldAccessOverride,
  TWorkspacePermission,
} from '#shared/types/workspace'

/** Every demo account's, so any of them can be signed in as. */
export const DEMO_PASSWORD = 'demo1234'

export const DEMO_WORKSPACE_NAME = 'Demo workspace'

export interface IDemoMember {
  email: string
  name: string
  roleName: string
}

/** The first owns the workspace; several share a role, so one role's members can be compared. */
export const DEMO_MEMBERS: readonly IDemoMember[] = [
  { email: 'anna_1@demo.com', name: 'Anna Petrova', roleName: 'Admin' },
  { email: 'boris_2@demo.com', name: 'Boris Ivanov', roleName: 'Admin' },
  { email: 'clara_3@demo.com', name: 'Clara Novak', roleName: 'Project manager' },
  { email: 'dmitry_4@demo.com', name: 'Dmitry Sokolov', roleName: 'Project manager' },
  { email: 'elena_5@demo.com', name: 'Elena Moroz', roleName: 'Accountant' },
  { email: 'felix_6@demo.com', name: 'Felix Weber', roleName: 'Consultant' },
  { email: 'grace_7@demo.com', name: 'Grace Lin', roleName: 'Consultant' },
  { email: 'hugo_8@demo.com', name: 'Hugo Martin', roleName: 'Intern' },
]

/** Accounts an earlier seed made, removed with the demo ones so a reseed leaves none behind. */
export const RETIRED_SEED_EMAILS = ['test@test.com', 'editor@test.com']

const READ: ITableAccess = {
  readScope: 'ALL',
  canCreate: false,
  updateScope: 'NONE',
  deleteScope: 'NONE',
}
const OWN_WORK: ITableAccess = {
  readScope: 'ALL',
  canCreate: true,
  updateScope: 'OWN',
  deleteScope: 'OWN',
}

export interface IDemoRole {
  name: string
  permissions: readonly TWorkspacePermission[]
  /** By table name; a table left out stays closed to the role. */
  tables: Readonly<Record<string, ITableAccess>>
  fields: readonly { table: string; field: string; access: TFieldAccessOverride }[]
}

const BUDGETS_HIDDEN = [
  { table: 'Clients', field: 'Annual budget', access: 'HIDDEN' },
  { table: 'Projects', field: 'Budget', access: 'HIDDEN' },
] as const

/** Admin is the workspace's default role, given its tables here like the rest. */
export const DEMO_ROLES: readonly IDemoRole[] = [
  {
    name: 'Admin',
    permissions: WORKSPACE_PERMISSIONS,
    tables: {
      Clients: FULL_TABLE_ACCESS,
      People: FULL_TABLE_ACCESS,
      Projects: FULL_TABLE_ACCESS,
      Tasks: FULL_TABLE_ACCESS,
      Invoices: FULL_TABLE_ACCESS,
      'Reading list': FULL_TABLE_ACCESS,
      'Office equipment': FULL_TABLE_ACCESS,
      Ideas: FULL_TABLE_ACCESS,
    },
    fields: [],
  },
  {
    name: 'Project manager',
    permissions: ['MEMBERS_INVITE'],
    tables: {
      Clients: { ...FULL_TABLE_ACCESS, deleteScope: 'OWN' },
      People: FULL_TABLE_ACCESS,
      Projects: FULL_TABLE_ACCESS,
      Tasks: FULL_TABLE_ACCESS,
      Invoices: READ,
      'Reading list': FULL_TABLE_ACCESS,
      'Office equipment': READ,
      Ideas: FULL_TABLE_ACCESS,
    },
    fields: [],
  },
  {
    name: 'Accountant',
    permissions: [],
    tables: {
      Clients: READ,
      People: READ,
      Projects: READ,
      Invoices: FULL_TABLE_ACCESS,
      'Reading list': READ,
      'Office equipment': FULL_TABLE_ACCESS,
    },
    fields: [],
  },
  {
    name: 'Consultant',
    permissions: [],
    tables: {
      Clients: READ,
      People: READ,
      Projects: READ,
      Tasks: OWN_WORK,
      'Reading list': OWN_WORK,
      'Office equipment': READ,
      Ideas: OWN_WORK,
    },
    fields: BUDGETS_HIDDEN,
  },
  {
    name: 'Intern',
    permissions: [],
    tables: {
      Clients: READ,
      People: READ,
      Projects: READ,
      Tasks: READ,
      'Reading list': READ,
      Ideas: READ,
    },
    fields: [
      ...BUDGETS_HIDDEN,
      { table: 'People', field: 'Email', access: 'HIDDEN' },
      { table: 'People', field: 'Phone', access: 'HIDDEN' },
    ],
  },
]

/**
 * Who made which records, so "only own" has something to show: every `every`-th record of a table,
 * starting at `offset`, is the member's. The owner made the rest.
 */
export const DEMO_AUTHORS: readonly {
  table: string
  email: string
  every: number
  offset: number
}[] = [
  { table: 'Tasks', email: 'felix_6@demo.com', every: 3, offset: 0 },
  { table: 'Tasks', email: 'grace_7@demo.com', every: 3, offset: 1 },
  { table: 'Ideas', email: 'felix_6@demo.com', every: 4, offset: 0 },
  { table: 'Clients', email: 'clara_3@demo.com', every: 4, offset: 0 },
]
