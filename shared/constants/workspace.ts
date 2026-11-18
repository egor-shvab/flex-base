import type { ITableAccess, TFieldAccess } from '#shared/types/workspace'

/** In the order a role editor lists them. Mirrors the Prisma `WorkspacePermission` enum. */
export const WORKSPACE_PERMISSIONS = [
  'WORKSPACE_UPDATE',
  'MEMBERS_INVITE',
  'MEMBERS_MANAGE',
  'ROLES_MANAGE',
  'TABLES_MANAGE',
] as const

/** Narrowest first: the order comparisons use. Mirrors the Prisma `RecordScope` enum. */
export const RECORD_SCOPES = ['NONE', 'OWN', 'ALL'] as const

/** What a role's row for a field may hold. Mirrors the Prisma `FieldAccess` enum. */
export const FIELD_ACCESS_OVERRIDES = ['HIDDEN', 'READ'] as const

/** Narrowest first, as `RECORD_SCOPES`. `EDIT` is never stored: it is the absence of a row. */
export const FIELD_ACCESS_LEVELS: readonly TFieldAccess[] = [...FIELD_ACCESS_OVERRIDES, 'EDIT']

/** What a member may do to a record beyond reading it, in the order a role editor lists them. */
export const RECORD_ACTIONS = ['create', 'update', 'delete'] as const

/** The owner's, whatever their role says. */
export const FULL_TABLE_ACCESS: ITableAccess = {
  readScope: 'ALL',
  canCreate: true,
  updateScope: 'ALL',
  deleteScope: 'ALL',
}

/** A role's on a table it has no row for. */
export const NO_TABLE_ACCESS: ITableAccess = {
  readScope: 'NONE',
  canCreate: false,
  updateScope: 'NONE',
  deleteScope: 'NONE',
}

export const WORKSPACE_ADDRESS_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

export const WORKSPACE_ADDRESS_LENGTH = 10

/** The owner is not a role (`Workspace.ownerId`), so a role named like one would mislead. */
export const RESERVED_ROLE_NAME = 'Owner'

/** How long an invitation can be accepted; sending it again restarts the count. */
export const INVITATION_TTL_DAYS = 7
