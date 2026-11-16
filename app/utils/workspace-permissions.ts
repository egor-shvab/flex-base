import type { ISelectOption } from '~/types/select'
import { RECORD_ACTIONS, WORKSPACE_PERMISSIONS } from '#shared/constants/workspace'
import type {
  IPermissionSet,
  IWorkspaceActor,
  IWorkspaceRole,
  TRecordAction,
  TWorkspacePermission,
} from '#shared/types/workspace'
import { canAssignRole, hasRecordAction } from '#shared/utils/permissions'
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

export const RECORD_ACTION_TEXT: Record<TRecordAction, IPermissionText> = {
  create: { label: 'Add records', description: 'Create records in every table' },
  update: { label: 'Edit records', description: 'Change records in every table' },
  delete: { label: 'Delete records', description: 'Remove records from every table' },
}

type TRecordDefaultsInput = TRoleInput['recordDefaults']

/** The role form's record defaults with one action granted on every record, or on none. */
export function applyRecordAction(
  access: TRecordDefaultsInput,
  action: TRecordAction,
  isGranted: boolean,
): TRecordDefaultsInput {
  if (action === 'create') return { ...access, canCreate: isGranted }

  const scope = isGranted ? 'ALL' : 'NONE'
  return action === 'update' ? { ...access, updateScope: scope } : { ...access, deleteScope: scope }
}

function listGrantLabels(set: IPermissionSet): string[] {
  return [
    ...WORKSPACE_PERMISSIONS.filter((permission) => set.permissions.includes(permission)).map(
      (permission) => WORKSPACE_PERMISSION_TEXT[permission].label,
    ),
    ...RECORD_ACTIONS.filter((action) => hasRecordAction(set.recordDefaults, action)).map(
      (action) => RECORD_ACTION_TEXT[action].label,
    ),
  ]
}

/** What a role lets its members do, beyond reading — which every member may. */
export function summarisePermissions(set: IPermissionSet): string {
  const labels = listGrantLabels(set)

  if (labels.length === 0) return 'Read only'
  if (labels.length === WORKSPACE_PERMISSIONS.length + RECORD_ACTIONS.length) {
    return 'Every permission'
  }

  return labels.join(', ')
}

/** How much a role grants, for ranking roles from the narrowest. */
export function toGrantCount(set: IPermissionSet): number {
  return (
    set.permissions.length +
    RECORD_ACTIONS.filter((action) => hasRecordAction(set.recordDefaults, action)).length
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
