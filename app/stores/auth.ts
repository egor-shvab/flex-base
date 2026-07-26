import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { navigateTo } from '#imports'
import { useApi } from '~/composables/useApi'
import type { IAuthUser } from '#shared/types/auth'
import type { TLoginInput } from '#shared/validation/auth'

export const useAuthStore = defineStore('auth', () => {
  const api = useApi()

  const user = ref<IAuthUser | null>(null)
  const initialized = ref(false)

  const isAuthenticated = computed(() => user.value !== null)

  async function fetchUser() {
    try {
      const response = await api<{ user: IAuthUser }>('/api/auth/me')
      user.value = response.user
    } catch {
      user.value = null
    } finally {
      initialized.value = true
    }
  }

  async function register(credentials: TLoginInput) {
    const response = await api<{ user: IAuthUser }>('/api/auth/register', {
      method: 'POST',
      body: credentials,
    })
    user.value = response.user
  }

  async function login(credentials: TLoginInput) {
    const response = await api<{ user: IAuthUser }>('/api/auth/login', {
      method: 'POST',
      body: credentials,
    })
    user.value = response.user
  }

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' })
    user.value = null
    await navigateTo('/auth/login')
  }

  return { user, initialized, isAuthenticated, fetchUser, register, login, logout }
})
