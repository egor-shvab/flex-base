/** In the order a role editor lists them. Mirrors the Prisma `WorkspacePermission` enum. */
export const WORKSPACE_PERMISSIONS = [
  'WORKSPACE_UPDATE',
  'MEMBERS_INVITE',
  'MEMBERS_MANAGE',
  'ROLES_MANAGE',
  'TABLES_MANAGE',
  'RECORDS_CREATE',
  'RECORDS_UPDATE',
  'RECORDS_DELETE',
] as const

export const WORKSPACE_ADDRESS_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

export const WORKSPACE_ADDRESS_LENGTH = 10

/** The owner is not a role (`Workspace.ownerId`), so a role named like one would mislead. */
export const RESERVED_ROLE_NAME = 'Owner'

/** How long an invitation can be accepted; sending it again restarts the count. */
export const INVITATION_TTL_DAYS = 7
