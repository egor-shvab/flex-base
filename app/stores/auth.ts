import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { reloadNuxtApp } from '#imports'
import { useAuthApi } from '~/api/auth'
import type { IHttpFailure } from '~/utils/api-error'
import type { IAuthUser } from '#shared/types/auth'
import type { TCredentialsInput, TProfileInput, TRegistrationInput } from '#shared/validation/auth'

export const useAuthStore = defineStore('auth', () => {
  const api = useAuthApi()

  const user = ref<IAuthUser | null>(null)
  const isInitialized = ref(false)

  const isAuthenticated = computed(() => user.value !== null)

  /**
   * Only a 401 means signed out. Any other failure — the server down, the network gone — is thrown
   * and leaves the store uninitialised, so the next navigation asks again instead of sending a
   * signed-in user to the login page.
   */
  async function fetchUser() {
    try {
      const response = await api.me()
      user.value = response.user
    } catch (error) {
      if ((error as IHttpFailure | null)?.statusCode !== 401) throw error
      user.value = null
    }
    isInitialized.value = true
  }

  async function register(input: TRegistrationInput) {
    const response = await api.register(input)
    user.value = response.user
  }

  async function updateProfile(input: TProfileInput) {
    const response = await api.updateProfile(input)
    user.value = response.user
  }

  async function login(credentials: TCredentialsInput) {
    const response = await api.login(credentials)
    user.value = response.user
  }

  /** A full reload, so no store keeps what the signed-out user could see. */
  async function logout() {
    await api.logout()
    user.value = null
    reloadNuxtApp({ path: '/auth/login' })
  }

  return {
    user,
    isInitialized,
    isAuthenticated,
    fetchUser,
    register,
    login,
    logout,
    updateProfile,
  }
})
