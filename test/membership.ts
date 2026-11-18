import { FULL_TABLE_ACCESS, WORKSPACE_PERMISSIONS } from '#shared/constants/workspace'
import type { IRecordActor } from '#server/db/records'
import type {
  ITableAccess,
  IWorkspaceMembership,
  TRecordScope,
  TWorkspacePermission,
} from '#shared/types/workspace'
import type { TRoleInput } from '#shared/validation/workspace'

export const MEMBERSHIP_WORKSPACE_ID = 'wsp_1'

/** One table's access: every record read, nothing more unless `overrides` grants it. */
export function buildTableAccess(overrides: Partial<ITableAccess> = {}): ITableAccess {
  return {
    readScope: 'ALL',
    canCreate: false,
    updateScope: 'NONE',
    deleteScope: 'NONE',
    ...overrides,
  }
}

/** A role's grants as `permissionSetSelect` reads them from the database. */
export function buildPermissionSetRow(permissions: TWorkspacePermission[] = []) {
  return { permissions }
}

/** A role form as submitted: closed to every table unless `tables` grants one. */
export function buildRoleInput(
  name: string,
  permissions: TWorkspacePermission[] = [],
  tables: TRoleInput['tables'] = [],
): TRoleInput {
  return { name, permissions, tables, fields: [] }
}

/** The caller's membership as the handler factories hand it to a service. */
export function buildMembership(
  permissions: TWorkspacePermission[],
  { isOwner = false, memberId = 'mem_actor' }: { isOwner?: boolean; memberId?: string } = {},
): IWorkspaceMembership {
  return {
    memberId,
    isOwner,
    permissions: isOwner ? [...WORKSPACE_PERMISSIONS] : permissions,
    role: { id: 'rol_actor', name: 'Manager' },
    workspace: {
      id: MEMBERSHIP_WORKSPACE_ID,
      publicId: 'k3f9x2m8qa',
      name: 'Acme',
      createdAt: '2026-01-05T09:14:00.000Z',
    },
  }
}

/** A caller of the record services; every linked table read whole unless `targetScopes` says. */
export function buildRecordActor(
  userId: string,
  access: ITableAccess = FULL_TABLE_ACCESS,
  targetScopes: ReadonlyMap<string, TRecordScope> = new Map(),
): IRecordActor {
  return { userId, access, targetScopes }
}

/** A caller who reaches every record of a table, for specs about something other than access. */
export const FULL_RECORD_ACTOR = buildRecordActor('usr_1')
