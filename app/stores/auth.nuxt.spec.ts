import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError } from 'h3'
import { createPinia, setActivePinia } from 'pinia'
import type { IAuthUser } from '#shared/types/auth'
import { useAuthStore } from '~/stores/auth'

const ADA: IAuthUser = { id: 'usr_1', email: 'ada@example.com', name: 'Ada' }

const reloadNuxtApp = vi.hoisted(() => vi.fn())
mockNuxtImport('reloadNuxtApp', () => reloadNuxtApp)

/** Path → the status it fails with. */
const failing = new Map<string, number>()

function endpoint(path: string, method: 'GET' | 'POST' | 'PATCH', user: IAuthUser | null = ADA) {
  registerEndpoint(path, {
    method,
    handler: () => {
      const statusCode = failing.get(path)
      if (statusCode !== undefined) throw createError({ statusCode, statusMessage: 'Nope' })
      return user === null ? { ok: true } : { user }
    },
  })
}

endpoint('/api/auth/me', 'GET')
endpoint('/api/auth/register', 'POST')
endpoint('/api/auth/login', 'POST')
endpoint('/api/auth/logout', 'POST', null)
endpoint('/api/auth/me', 'PATCH', { ...ADA, name: 'Ada Lovelace' })

const CREDENTIALS = { name: 'Ada', email: 'ada@example.com', password: 'correct-horse' }

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    failing.clear()
    reloadNuxtApp.mockClear()
  })

  it('starts signed out and uninitialized', () => {
    const store = useAuthStore()

    expect(store.user).toBeNull()
    expect(store.isAuthenticated).toBe(false)
    expect(store.isInitialized).toBe(false)
  })

  describe('fetchUser', () => {
    it('adopts the session the server reports', async () => {
      const store = useAuthStore()

      await store.fetchUser()

      expect(store.user).toEqual(ADA)
      expect(store.isAuthenticated).toBe(true)
    })

    it('reads a 401 as signed out rather than throwing', async () => {
      failing.set('/api/auth/me', 401)
      const store = useAuthStore()

      await expect(store.fetchUser()).resolves.toBeUndefined()

      expect(store.user).toBeNull()
      expect(store.isAuthenticated).toBe(false)
    })

    it('marks itself initialized once it has an answer, signed in or out', async () => {
      const signedIn = useAuthStore()
      await signedIn.fetchUser()
      expect(signedIn.isInitialized).toBe(true)

      setActivePinia(createPinia())
      failing.set('/api/auth/me', 401)
      const signedOut = useAuthStore()
      await signedOut.fetchUser()
      expect(signedOut.isInitialized).toBe(true)
    })

    it('throws on a server fault and stays uninitialised, so the next navigation asks again', async () => {
      failing.set('/api/auth/me', 500)
      const store = useAuthStore()

      await expect(store.fetchUser()).rejects.toMatchObject({ statusCode: 500 })

      expect(store.isInitialized).toBe(false)
      expect(store.user).toBeNull()

      failing.clear()
      await store.fetchUser()
      expect(store.user).toEqual(ADA)
    })
  })

  describe('signing in', () => {
    it.each(['register', 'login'] as const)('adopts the user %s returns', async (action) => {
      const store = useAuthStore()

      await store[action](CREDENTIALS)

      expect(store.user).toEqual(ADA)
      expect(store.isAuthenticated).toBe(true)
    })

    it.each([
      ['register', '/api/auth/register'],
      ['login', '/api/auth/login'],
    ] as const)('lets a failed %s reject', async (action, path) => {
      failing.set(path, 401)
      const store = useAuthStore()

      await expect(store[action](CREDENTIALS)).rejects.toThrow()
      expect(store.user).toBeNull()
    })
  })

  describe('updateProfile', () => {
    it('adopts the user the server returns', async () => {
      const store = useAuthStore()
      await store.login(CREDENTIALS)

      await store.updateProfile({ name: 'Ada Lovelace' })

      expect(store.user).toEqual({ ...ADA, name: 'Ada Lovelace' })
    })
  })

  describe('logout', () => {
    it('clears the session and reloads onto the login page, dropping every store', async () => {
      const store = useAuthStore()
      await store.login(CREDENTIALS)
      expect(store.isAuthenticated).toBe(true)

      await store.logout()

      expect(store.user).toBeNull()
      expect(store.isAuthenticated).toBe(false)
      expect(reloadNuxtApp).toHaveBeenCalledWith({ path: '/auth/login' })
    })

    it('keeps the session when the request fails', async () => {
      const store = useAuthStore()
      await store.login(CREDENTIALS)

      failing.set('/api/auth/logout', 500)
      await expect(store.logout()).rejects.toThrow()

      expect(store.user).toEqual(ADA)
      expect(reloadNuxtApp).not.toHaveBeenCalled()
    })
  })
})
