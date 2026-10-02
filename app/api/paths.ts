export const apiPath = {
  me: '/api/auth/me',
  login: '/api/auth/login',
  register: '/api/auth/register',
  logout: '/api/auth/logout',

  tables: '/api/tables',
  table: (tableAddress: string) => `/api/tables/${tableAddress}`,

  fields: (tableAddress: string) => `/api/tables/${tableAddress}/fields`,
  field: (tableAddress: string, fieldId: string) => `/api/tables/${tableAddress}/fields/${fieldId}`,
  fieldOptions: (tableAddress: string, fieldId: string) =>
    `/api/tables/${tableAddress}/fields/${fieldId}/options`,

  clientErrors: '/api/client-errors',

  records: (tableAddress: string) => `/api/tables/${tableAddress}/records`,
  record: (tableAddress: string, recordAddress: string) =>
    `/api/tables/${tableAddress}/records/${recordAddress}`,
} as const
