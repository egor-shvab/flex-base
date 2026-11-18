export type TWorkspaceSettingsSection = 'general' | 'members' | 'roles' | 'danger'

/** The app's own page URLs, as `apiPath` holds the API's. */
export const pagePath = {
  invitations: '/invitations',
  workspace: (workspaceAddress: string) => `/w/${workspaceAddress}`,
  workspaceSettings: (workspaceAddress: string, section: TWorkspaceSettingsSection = 'general') =>
    `/w/${workspaceAddress}/settings/${section}`,
  role: (workspaceAddress: string, roleId: string) =>
    `/w/${workspaceAddress}/settings/roles/${roleId}`,
  newRole: (workspaceAddress: string) => `/w/${workspaceAddress}/settings/roles/new`,
  table: (workspaceAddress: string, tableAddress: string) =>
    `/w/${workspaceAddress}/tables/${tableAddress}`,
  tableSettings: (workspaceAddress: string, tableAddress: string) =>
    `/w/${workspaceAddress}/tables/${tableAddress}/settings`,
} as const
