import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { navigateTo } from '#imports'
import { useAuthApi } from '~/api/auth'
import type { IAuthUser } from '#shared/types/auth'
import type { TCredentialsInput } from '#shared/validation/auth'

export const useAuthStore = defineStore('auth', () => {
  const api = useAuthApi()

  const user = ref<IAuthUser | null>(null)
  const initialized = ref(false)

  const isAuthenticated = computed(() => user.value !== null)

  async function fetchUser() {
    try {
      const response = await api.me()
      user.value = response.user
    } catch {
      user.value = null
    } finally {
      initialized.value = true
    }
  }

  async function register(credentials: TCredentialsInput) {
    const response = await api.register(credentials)
    user.value = response.user
  }

  async function login(credentials: TCredentialsInput) {
    const response = await api.login(credentials)
    user.value = response.user
  }

  async function logout() {
    await api.logout()
    user.value = null
    await navigateTo('/auth/login')
  }

  return { user, initialized, isAuthenticated, fetchUser, register, login, logout }
})
