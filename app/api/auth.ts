import { useApi } from '~/api/client'
import { apiPath } from '~/api/paths'
import type { IAuthUserResponse, IOkResponse } from '#shared/types/api'
import type { TCredentialsInput } from '#shared/validation/auth'

export function useAuthApi() {
  const api = useApi()

  return {
    me: () => api<IAuthUserResponse>(apiPath.me),
    login: (credentials: TCredentialsInput) =>
      api<IAuthUserResponse>(apiPath.login, { method: 'POST', body: credentials }),
    register: (credentials: TCredentialsInput) =>
      api<IAuthUserResponse>(apiPath.register, { method: 'POST', body: credentials }),
    logout: () => api<IOkResponse>(apiPath.logout, { method: 'POST' }),
  }
}
