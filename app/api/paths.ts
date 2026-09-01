/**
 * Every route the client calls, in one place. A path was previously written wherever it was
 * needed — the relation-options route in two stores, the whole tree across seven files — so a
 * route rename was a search across layers rather than an edit here.
 *
 * Strings and nothing else: these are the URL half of the contract, and `#shared/types/api` is
 * the response half. Neither knows how a request is made.
 */
export const apiPath = {
  me: '/api/auth/me',
  login: '/api/auth/login',
  register: '/api/auth/register',
  logout: '/api/auth/logout',

  tables: '/api/tables',
  table: (tableAddress: string) => `/api/tables/${tableAddress}`,

  // A table is named by its address — its public number, or the cuid an older link holds. A
  // **field** is always its cuid: fields have no public number, because none of them ever
  // reaches the address bar. The mixed pair below is deliberate.
  fields: (tableAddress: string) => `/api/tables/${tableAddress}/fields`,
  field: (tableAddress: string, fieldId: string) => `/api/tables/${tableAddress}/fields/${fieldId}`,
  fieldOptions: (tableAddress: string, fieldId: string) =>
    `/api/tables/${tableAddress}/fields/${fieldId}/options`,

  clientErrors: '/api/client-errors',

  records: (tableAddress: string) => `/api/tables/${tableAddress}/records`,
  record: (tableAddress: string, recordAddress: string) =>
    `/api/tables/${tableAddress}/records/${recordAddress}`,
} as const
