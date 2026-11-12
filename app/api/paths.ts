const workspacePath = (workspaceAddress: string) => `/api/workspaces/${workspaceAddress}`

const tablePath = (workspaceAddress: string, tableAddress: string) =>
  `${workspacePath(workspaceAddress)}/tables/${tableAddress}`

export const apiPath = {
  me: '/api/auth/me',
  login: '/api/auth/login',
  register: '/api/auth/register',
  logout: '/api/auth/logout',

  workspaces: '/api/workspaces',
  workspace: workspacePath,
  workspaceVisit: (workspaceAddress: string) => `${workspacePath(workspaceAddress)}/visit`,

  tables: (workspaceAddress: string) => `${workspacePath(workspaceAddress)}/tables`,
  table: tablePath,

  fields: (workspaceAddress: string, tableAddress: string) =>
    `${tablePath(workspaceAddress, tableAddress)}/fields`,
  field: (workspaceAddress: string, tableAddress: string, fieldId: string) =>
    `${tablePath(workspaceAddress, tableAddress)}/fields/${fieldId}`,
  fieldOptions: (workspaceAddress: string, tableAddress: string, fieldId: string) =>
    `${tablePath(workspaceAddress, tableAddress)}/fields/${fieldId}/options`,

  clientErrors: '/api/client-errors',

  records: (workspaceAddress: string, tableAddress: string) =>
    `${tablePath(workspaceAddress, tableAddress)}/records`,
  record: (workspaceAddress: string, tableAddress: string, recordAddress: string) =>
    `${tablePath(workspaceAddress, tableAddress)}/records/${recordAddress}`,
} as const
