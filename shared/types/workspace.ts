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

export interface IRoleRef {
  id: string
  name: string
}

/**
 * The caller's place in one workspace. `permissions` is what they may do — every permission for
 * the owner, whatever `role` grants.
 */
export interface IWorkspaceMembership extends IWorkspaceActor {
  workspace: IWorkspace
  role: IRoleRef
}

export interface IPermissionSet {
  permissions: readonly TWorkspacePermission[]
}

export interface IWorkspaceRole extends IRoleRef, IPermissionSet {
  memberCount: number
}

/** A membership someone may try to change or end, with the permissions its role grants. */
export interface IManagedMember {
  id: string
  isOwner: boolean
  role: IPermissionSet
}
