import type { ISelectOption } from '~/types/select'
import {
  FULL_TABLE_ACCESS,
  RECORD_SCOPES,
  WORKSPACE_PERMISSIONS,
} from '#shared/constants/workspace'
import type {
  IPermissionSet,
  IWorkspaceActor,
  IWorkspaceRole,
  TRecordScope,
  TWorkspacePermission,
} from '#shared/types/workspace'
import { canAssignRole, isScopeWithin, isTableAccessWithin } from '#shared/utils/permissions'
import type { TRoleInput } from '#shared/validation/workspace'

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
    description: 'Create, rename and delete tables, and change their fields',
  },
}

export const CREATE_RECORDS_TEXT: IPermissionText = {
  label: 'Add records',
  description: 'Create records in every table',
}

export type TScopedRecordKey = 'readScope' | 'updateScope' | 'deleteScope'

/** A scope's control in the role editor, and the role summary's words for each scope it grants. */
export const RECORD_SCOPE_TEXT: Record<
  TScopedRecordKey,
  { label: string; summary: Partial<Record<TRecordScope, string>> }
> = {
  readScope: { label: 'Records they see', summary: { OWN: 'Sees only own records' } },
  updateScope: {
    label: 'Records they can edit',
    summary: { OWN: 'Edit own records', ALL: 'Edit records' },
  },
  deleteScope: {
    label: 'Records they can delete',
    summary: { OWN: 'Delete own records', ALL: 'Delete records' },
  },
}

const SCOPE_OPTION_LABELS: Record<TRecordScope, string> = {
  NONE: 'None',
  OWN: 'Only their own',
  ALL: 'All records',
}

type TRecordDefaultsInput = TRoleInput['recordDefaults']

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

/** The role form's record defaults with a new read, its actions narrowed to stay within it. */
export function applyReadScope(
  access: TRecordDefaultsInput,
  readScope: TRecordDefaultsInput['readScope'],
): TRecordDefaultsInput {
  const narrow = (scope: TRecordScope) => (isScopeWithin(scope, readScope) ? scope : readScope)

  return {
    ...access,
    readScope,
    updateScope: narrow(access.updateScope),
    deleteScope: narrow(access.deleteScope),
  }
}

function listGrantLabels(set: IPermissionSet): string[] {
  const { recordDefaults } = set
  const scopeLabels = (['readScope', 'updateScope', 'deleteScope'] as const).flatMap(
    (key) => RECORD_SCOPE_TEXT[key].summary[recordDefaults[key]] ?? [],
  )

  return [
    ...WORKSPACE_PERMISSIONS.filter((permission) => set.permissions.includes(permission)).map(
      (permission) => WORKSPACE_PERMISSION_TEXT[permission].label,
    ),
    ...(recordDefaults.canCreate ? [CREATE_RECORDS_TEXT.label] : []),
    ...scopeLabels,
  ]
}

/** What a role lets its members do beyond reading every record, which is the default. */
export function summarisePermissions(set: IPermissionSet): string {
  if (
    set.permissions.length === WORKSPACE_PERMISSIONS.length &&
    isTableAccessWithin(FULL_TABLE_ACCESS, set.recordDefaults)
  ) {
    return 'Every permission'
  }

  const labels = listGrantLabels(set)
  return labels.length === 0 ? 'Read only' : labels.join(', ')
}

/** How much a role grants, for ranking roles from the narrowest: a wider scope counts for more. */
export function toGrantCount(set: IPermissionSet): number {
  const { readScope, canCreate, updateScope, deleteScope } = set.recordDefaults

  return (
    set.permissions.length +
    Number(canCreate) +
    [readScope, updateScope, deleteScope].reduce(
      (sum, scope) => sum + RECORD_SCOPES.indexOf(scope),
      0,
    )
  )
}

/** The roles `actor` may hand out, as the options of a role picker. */
export function buildAssignableRoleOptions(
  actor: IWorkspaceActor,
  roles: readonly IWorkspaceRole[],
): ISelectOption[] {
  return roles
    .filter((role) => canAssignRole(actor, role))
    .map((role) => ({ value: role.id, label: role.name }))
}
