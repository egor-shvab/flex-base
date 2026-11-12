export type TWorkspaceSettingsSection = 'general' | 'danger'

/** The app's own page URLs, as `apiPath` holds the API's. */
export const pagePath = {
  workspace: (workspaceAddress: string) => `/w/${workspaceAddress}`,
  workspaceSettings: (workspaceAddress: string, section: TWorkspaceSettingsSection = 'general') =>
    `/w/${workspaceAddress}/settings/${section}`,
  table: (workspaceAddress: string, tableAddress: string) =>
    `/w/${workspaceAddress}/tables/${tableAddress}`,
  tableSettings: (workspaceAddress: string, tableAddress: string) =>
    `/w/${workspaceAddress}/tables/${tableAddress}/settings`,
} as const
