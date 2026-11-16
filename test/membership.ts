import { FULL_TABLE_ACCESS, WORKSPACE_PERMISSIONS } from '#shared/constants/workspace'
import type {
  ITableAccess,
  IWorkspaceMembership,
  TWorkspacePermission,
} from '#shared/types/workspace'
import type { TRoleInput } from '#shared/validation/workspace'

export const MEMBERSHIP_WORKSPACE_ID = 'wsp_1'

/** A role's record defaults: every member reads, nothing more unless `overrides` grants it. */
export function buildRecordDefaults(overrides: Partial<ITableAccess> = {}): ITableAccess {
  return {
    readScope: 'ALL',
    canCreate: false,
    updateScope: 'NONE',
    deleteScope: 'NONE',
    ...overrides,
  }
}

/** A role's grants as `permissionSetSelect` reads them from the database. */
export function buildPermissionSetRow(
  permissions: TWorkspacePermission[] = [],
  records: Partial<ITableAccess> = {},
) {
  return { permissions, ...buildRecordDefaults(records) }
}

/** A role form as submitted: read-only unless `records` grants more. */
export function buildRoleInput(
  name: string,
  permissions: TWorkspacePermission[] = [],
  records: Partial<TRoleInput['recordDefaults']> = {},
): TRoleInput {
  return {
    name,
    permissions,
    recordDefaults: {
      readScope: 'ALL',
      canCreate: false,
      updateScope: 'NONE',
      deleteScope: 'NONE',
      ...records,
    },
  }
}

/** The caller's membership as the handler factories hand it to a service. */
export function buildMembership(
  permissions: TWorkspacePermission[],
  {
    isOwner = false,
    memberId = 'mem_actor',
    recordDefaults = buildRecordDefaults(),
  }: { isOwner?: boolean; memberId?: string; recordDefaults?: ITableAccess } = {},
): IWorkspaceMembership {
  return {
    memberId,
    isOwner,
    permissions: isOwner ? [...WORKSPACE_PERMISSIONS] : permissions,
    recordDefaults: isOwner ? FULL_TABLE_ACCESS : recordDefaults,
    role: { id: 'rol_actor', name: 'Manager' },
    workspace: {
      id: MEMBERSHIP_WORKSPACE_ID,
      publicId: 'k3f9x2m8qa',
      name: 'Acme',
      createdAt: '2026-01-05T09:14:00.000Z',
    },
  }
}

/** A caller who reaches every record of a table, for specs about something other than access. */
export const FULL_RECORD_ACTOR = { userId: 'usr_1', access: FULL_TABLE_ACCESS }
