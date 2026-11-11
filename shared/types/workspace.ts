import type { WORKSPACE_PERMISSIONS } from '#shared/constants/workspace'

export type TWorkspacePermission = (typeof WORKSPACE_PERMISSIONS)[number]

export interface IWorkspace {
  id: string
  publicId: string
  name: string
  createdAt: string
}

/** The caller inside one workspace: who they are there and what they may do. */
export interface IWorkspaceActor {
  memberId: string
  isOwner: boolean
  permissions: readonly TWorkspacePermission[]
}

export interface IPermissionSet {
  permissions: readonly TWorkspacePermission[]
}

/** A membership someone may try to change or end, with the permissions its role grants. */
export interface IManagedMember {
  id: string
  isOwner: boolean
  role: IPermissionSet
}
