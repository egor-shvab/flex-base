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
  table: (tableId: string) => `/api/tables/${tableId}`,

  fields: (tableId: string) => `/api/tables/${tableId}/fields`,
  field: (tableId: string, fieldId: string) => `/api/tables/${tableId}/fields/${fieldId}`,
  fieldOptions: (tableId: string, fieldId: string) =>
    `/api/tables/${tableId}/fields/${fieldId}/options`,

  records: (tableId: string) => `/api/tables/${tableId}/records`,
  record: (tableId: string, recordId: string) => `/api/tables/${tableId}/records/${recordId}`,
} as const
