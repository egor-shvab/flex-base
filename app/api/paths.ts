/**
 * Every route the client calls, in one place, so a route rename is an edit here rather than a
 * search across layers.
 *
 * Strings and nothing else: the URL half of the contract, where `#shared/types/api` is the
 * response half. Neither knows how a request is made.
 */
export const apiPath = {
  me: '/api/auth/me',
  login: '/api/auth/login',
  register: '/api/auth/register',
  logout: '/api/auth/logout',

  tables: '/api/tables',
  table: (tableAddress: string) => `/api/tables/${tableAddress}`,

  // A table is named by its address — its number, or the cuid an older link holds. A **field**
  // is always its cuid: fields have no public number, so none reaches the address bar. The
  // mixed pair below is deliberate.
  fields: (tableAddress: string) => `/api/tables/${tableAddress}/fields`,
  field: (tableAddress: string, fieldId: string) => `/api/tables/${tableAddress}/fields/${fieldId}`,
  fieldOptions: (tableAddress: string, fieldId: string) =>
    `/api/tables/${tableAddress}/fields/${fieldId}/options`,

  clientErrors: '/api/client-errors',

  records: (tableAddress: string) => `/api/tables/${tableAddress}/records`,
  record: (tableAddress: string, recordAddress: string) =>
    `/api/tables/${tableAddress}/records/${recordAddress}`,
} as const
