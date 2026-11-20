import { WORKSPACE_PERMISSIONS } from '#shared/constants/workspace'
import type { TWorkspacePermission } from '#shared/types/workspace'

/**
 * The roles the specs lean on, made in every rig workspace: the app itself starts one with Admin
 * alone, and the specs speak of an Editor and a Viewer.
 */
export const RIG_ROLES: readonly { name: string; permissions: readonly TWorkspacePermission[] }[] =
  [
    { name: 'Admin', permissions: WORKSPACE_PERMISSIONS },
    { name: 'Editor', permissions: [] },
    { name: 'Viewer', permissions: [] },
  ]
