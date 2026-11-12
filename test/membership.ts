import { WORKSPACE_PERMISSIONS } from '#shared/constants/workspace'
import type { IWorkspaceMembership, TWorkspacePermission } from '#shared/types/workspace'

export const MEMBERSHIP_WORKSPACE_ID = 'wsp_1'

/** The caller's membership as the handler factories hand it to a service. */
export function buildMembership(
  permissions: TWorkspacePermission[],
  { isOwner = false, memberId = 'mem_actor' } = {},
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
