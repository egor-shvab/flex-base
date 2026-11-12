import { WORKSPACE_PERMISSIONS } from '#shared/constants/workspace'
import type { TWorkspacePermission } from '#shared/types/workspace'

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
  RECORDS_CREATE: { label: 'Add records', description: 'Create records in every table' },
  RECORDS_UPDATE: { label: 'Edit records', description: 'Change records in every table' },
  RECORDS_DELETE: { label: 'Delete records', description: 'Remove records from every table' },
}

/** What a role lets its members do, beyond reading — which every member may. */
export function summarisePermissions(permissions: readonly TWorkspacePermission[]): string {
  if (permissions.length === 0) return 'Read only'
  if (permissions.length === WORKSPACE_PERMISSIONS.length) return 'Every permission'

  return WORKSPACE_PERMISSIONS.filter((permission) => permissions.includes(permission))
    .map((permission) => WORKSPACE_PERMISSION_TEXT[permission].label)
    .join(', ')
}
