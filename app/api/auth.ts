import { useApi } from '~/api/client'
import { apiPath } from '~/api/paths'
import type { IAuthUserResponse, IOkResponse } from '#shared/types/api'
import type { TCredentialsInput, TProfileInput, TRegistrationInput } from '#shared/validation/auth'

export function useAuthApi() {
  const api = useApi()

  return {
    me: () => api<IAuthUserResponse>(apiPath.me),
    login: (credentials: TCredentialsInput) =>
      api<IAuthUserResponse>(apiPath.login, { method: 'POST', body: credentials }),
    register: (input: TRegistrationInput) =>
      api<IAuthUserResponse>(apiPath.register, { method: 'POST', body: input }),
    updateProfile: (input: TProfileInput) =>
      api<IAuthUserResponse>(apiPath.me, { method: 'PATCH', body: input }),
    logout: () => api<IOkResponse>(apiPath.logout, { method: 'POST' }),
  }
}
