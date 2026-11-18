import type { ISelectOption } from '~/types/select'
import { formatCount } from '~/utils/format'
import { isRoleVisibilityBypassed } from '~/utils/role-form'
import { RESERVED_ROLE_NAME, WORKSPACE_PERMISSIONS } from '#shared/constants/workspace'
import type {
  IRoleRef,
  ITableAccess,
  IWorkspaceRole,
  TRecordScope,
  TWorkspacePermission,
} from '#shared/types/workspace'
import { isScopeWithin } from '#shared/utils/permissions'

interface IPermissionText {
  label: string
  description: string
}

/** Total over the permissions, so a new one does not compile until it is described. */
export const WORKSPACE_PERMISSION_TEXT: Record<TWorkspacePermission, IPermissionText> = {
  WORKSPACE_UPDATE: { label: 'Rename the workspace', description: 'Change its name' },
  MEMBERS_INVITE: {
    label: 'Invite members',
    description: 'See, send and revoke invitations',
  },
  MEMBERS_MANAGE: {
    label: 'Manage members',
    description: 'Change a member’s role or remove them',
  },
  ROLES_MANAGE: { label: 'Manage roles', description: 'Create, change and delete roles' },
  TABLES_MANAGE: {
    label: 'Manage tables',
    description:
      'Create, rename and delete tables, and change their fields. Sees every table, field and record, whatever the role’s table access',
  },
}

export type TScopedRecordKey = 'readScope' | 'updateScope' | 'deleteScope'

/**
 * The role editor's four record columns: the column's word, and the phrase that names one of its
 * controls — which holds the word, so a control's name contains its visible label.
 */
export const RECORD_ACCESS_TEXT: Record<keyof ITableAccess, { label: string; phrase: string }> = {
  readScope: { label: 'Sees', phrase: 'Sees records in' },
  canCreate: { label: 'Adds', phrase: 'Adds records to' },
  updateScope: { label: 'Edits', phrase: 'Edits records in' },
  deleteScope: { label: 'Deletes', phrase: 'Deletes records in' },
}

const SCOPE_OPTION_LABELS: Record<TRecordScope, string> = {
  NONE: 'None',
  OWN: 'Only own',
  ALL: 'All',
}

/**
 * The options of one scope's control. A scope wider than `limit` is shown but disabled: the
 * editor's own reach, and for an action the role's read, which no action may pass.
 */
export function buildScopeOptions(
  scopes: readonly TRecordScope[],
  limit: (scope: TRecordScope) => boolean,
): ISelectOption<TRecordScope>[] {
  return scopes.map((scope) => ({
    value: scope,
    label: SCOPE_OPTION_LABELS[scope],
    disabled: !limit(scope),
  }))
}

/**
 * A table's access with a new read, its actions narrowed to stay within it: none reaches past the
 * read, and no record is added where none can be read.
 */
export function applyReadScope(access: ITableAccess, readScope: TRecordScope): ITableAccess {
  const narrow = (scope: TRecordScope) => (isScopeWithin(scope, readScope) ? scope : readScope)

  return {
    ...access,
    readScope,
    canCreate: access.canCreate && readScope !== 'NONE',
    updateScope: narrow(access.updateScope),
    deleteScope: narrow(access.deleteScope),
  }
}

/** A member's role as shown beside them: the owner is named as such, whatever role they hold. */
export function formatMemberRole(member: { isOwner: boolean; role: IRoleRef }): string {
  return member.isOwner ? RESERVED_ROLE_NAME : member.role.name
}

/**
 * What a role lets its members do: its workspace permissions, then the tables it reads — every one
 * for a role that manages tables, whatever rows it holds.
 */
export function summarisePermissions(role: IWorkspaceRole): string {
  const tables = isRoleVisibilityBypassed(role)
    ? 'Records in every table'
    : role.readableTableCount === 0
      ? 'No tables'
      : `Records in ${formatCount(role.readableTableCount, 'table')}`
  const labels =
    role.permissions.length === WORKSPACE_PERMISSIONS.length
      ? ['Every permission']
      : WORKSPACE_PERMISSIONS.filter((permission) => role.permissions.includes(permission)).map(
          (permission) => WORKSPACE_PERMISSION_TEXT[permission].label,
        )

  return [...labels, tables].join(', ')
}

/** How much a role grants, for ranking roles from the narrowest: every table outranks any count. */
export function toGrantCount(role: IWorkspaceRole): number {
  const tableCount = isRoleVisibilityBypassed(role) ? Infinity : role.readableTableCount
  return role.permissions.length + tableCount
}

/** The roles the caller may hand out — those within them — as the options of a role picker. */
export function buildAssignableRoleOptions(roles: readonly IWorkspaceRole[]): ISelectOption[] {
  return roles
    .filter((role) => role.isWithinCaller)
    .map((role) => ({ value: role.id, label: role.name }))
}
