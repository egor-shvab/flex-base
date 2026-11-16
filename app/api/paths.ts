/**
 * Every dynamic segment is encoded: an address comes from the page's own URL, already decoded, and a
 * crafted `%2F..%2F` in it would otherwise steer the request to another endpoint.
 */
const segment = encodeURIComponent

const workspacePath = (workspaceAddress: string) => `/api/workspaces/${segment(workspaceAddress)}`

const tablePath = (workspaceAddress: string, tableAddress: string) =>
  `${workspacePath(workspaceAddress)}/tables/${segment(tableAddress)}`

export const apiPath = {
  me: '/api/auth/me',
  login: '/api/auth/login',
  register: '/api/auth/register',
  logout: '/api/auth/logout',

  workspaces: '/api/workspaces',
  workspace: workspacePath,
  workspaceVisit: (workspaceAddress: string) => `${workspacePath(workspaceAddress)}/visit`,
  workspaceTransfer: (workspaceAddress: string) => `${workspacePath(workspaceAddress)}/transfer`,
  workspaceLeave: (workspaceAddress: string) => `${workspacePath(workspaceAddress)}/leave`,

  members: (workspaceAddress: string) => `${workspacePath(workspaceAddress)}/members`,
  member: (workspaceAddress: string, memberId: string) =>
    `${workspacePath(workspaceAddress)}/members/${segment(memberId)}`,

  invitations: (workspaceAddress: string) => `${workspacePath(workspaceAddress)}/invitations`,
  invitation: (workspaceAddress: string, invitationId: string) =>
    `${workspacePath(workspaceAddress)}/invitations/${segment(invitationId)}`,

  incomingInvitations: '/api/invitations',
  incomingInvitation: (invitationId: string) => `/api/invitations/${segment(invitationId)}`,
  incomingInvitationAccept: (invitationId: string) =>
    `/api/invitations/${segment(invitationId)}/accept`,

  roles: (workspaceAddress: string) => `${workspacePath(workspaceAddress)}/roles`,
  role: (workspaceAddress: string, roleId: string) =>
    `${workspacePath(workspaceAddress)}/roles/${segment(roleId)}`,
  roleAccess: (workspaceAddress: string, roleId: string) =>
    `${workspacePath(workspaceAddress)}/roles/${segment(roleId)}/access`,

  tables: (workspaceAddress: string) => `${workspacePath(workspaceAddress)}/tables`,
  table: tablePath,

  fields: (workspaceAddress: string, tableAddress: string) =>
    `${tablePath(workspaceAddress, tableAddress)}/fields`,
  field: (workspaceAddress: string, tableAddress: string, fieldId: string) =>
    `${tablePath(workspaceAddress, tableAddress)}/fields/${segment(fieldId)}`,
  fieldOptions: (workspaceAddress: string, tableAddress: string, fieldId: string) =>
    `${tablePath(workspaceAddress, tableAddress)}/fields/${segment(fieldId)}/options`,

  clientErrors: '/api/client-errors',

  records: (workspaceAddress: string, tableAddress: string) =>
    `${tablePath(workspaceAddress, tableAddress)}/records`,
  record: (workspaceAddress: string, tableAddress: string, recordAddress: string) =>
    `${tablePath(workspaceAddress, tableAddress)}/records/${segment(recordAddress)}`,
} as const
