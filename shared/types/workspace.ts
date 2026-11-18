import type {
  FIELD_ACCESS_OVERRIDES,
  RECORD_ACTIONS,
  RECORD_SCOPES,
  WORKSPACE_PERMISSIONS,
} from '#shared/constants/workspace'
import type { IUserRef } from '#shared/types/auth'
import type { TFieldType } from '#shared/types/field'

export type TWorkspacePermission = (typeof WORKSPACE_PERMISSIONS)[number]

/** Which records an action reaches: none, those the member created, or all of them. */
export type TRecordScope = (typeof RECORD_SCOPES)[number]

export type TRecordAction = (typeof RECORD_ACTIONS)[number]

/** What a role may do with one field: `EDIT` is never stored, it is the absence of a row. */
export type TFieldAccess = TFieldAccessOverride | 'EDIT'

export type TFieldAccessOverride = (typeof FIELD_ACCESS_OVERRIDES)[number]

/** What a member may do with the records of one table. */
export interface ITableAccess {
  readScope: TRecordScope
  canCreate: boolean
  updateScope: TRecordScope
  deleteScope: TRecordScope
}

/** What a role grants across the workspace; record access is granted table by table. */
export interface IPermissionSet {
  permissions: readonly TWorkspacePermission[]
}

/** A role's record access for one table; a table without one is closed to the role. */
export interface ITableAccessRow extends ITableAccess {
  tableId: string
}

/** A role's row narrowing one field. */
export interface IFieldAccessOverride {
  fieldId: string
  access: TFieldAccessOverride
}

/** What a role grants table by table and field by field. */
export interface IRoleRows {
  tables: ITableAccessRow[]
  fields: IFieldAccessOverride[]
}

/** Everything a role grants; anti-escalation compares two of these over a workspace's tables. */
export interface IRoleGrants extends IPermissionSet, IRoleRows {}

/** A field as a role's access is set on it. */
export interface IAccessField {
  id: string
  name: string
  type: TFieldType
  required: boolean
}

/** A workspace's tables and their fields: what an access comparison walks, and an editor lists. */
export interface IAccessTable {
  id: string
  name: string
  fields: IAccessField[]
}

export interface IWorkspace {
  id: string
  publicId: string
  name: string
  createdAt: string
}

/** The caller inside one workspace: who they are there and what they may do. */
export interface IWorkspaceActor extends IPermissionSet {
  memberId: string
  isOwner: boolean
}

export interface IRoleRef {
  id: string
  name: string
}

/**
 * The caller's place in one workspace. `permissions` are what they may do — everything for the
 * owner, whatever `role` grants.
 */
export interface IWorkspaceMembership extends IWorkspaceActor {
  workspace: IWorkspace
  role: IRoleRef
}

export interface IWorkspaceRole extends IRoleRef, IPermissionSet {
  memberCount: number
  /**
   * The tables the role has a row for, each of which it reads. A role that manages tables reads
   * every table whatever this says.
   */
  readableTableCount: number
  /**
   * Whether the role grants nothing beyond the caller, on any table or field: what assigning it, or
   * managing a member who holds it, requires — and editing or deleting it, with the rest of
   * `canEditRole`. Always false for a caller who can do none of those.
   */
  isWithinCaller: boolean
  /** The version an edit sends as `If-Match`. */
  updatedAt: string
}

/** A membership someone may try to change or end. */
export interface IManagedMember {
  id: string
  isOwner: boolean
}

/** A workspace's member as its other members see them — the email included, for them alone. */
export interface IWorkspaceMember extends IManagedMember {
  user: IUserRef
  email: string
  role: IRoleRef & IPermissionSet
  joinedAt: string
}

/** An invitation as the workspace's inviters see it. */
export interface IWorkspaceInvitation {
  id: string
  email: string
  role: IRoleRef
  invitedBy: IUserRef | null
  expiresAt: string
  isExpired: boolean
}

/** An invitation as the person invited sees it: no more of the workspace than its name. */
export interface IIncomingInvitation {
  id: string
  workspace: { name: string }
  role: { name: string }
  invitedBy: IUserRef | null
  expiresAt: string
}
