import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError } from 'h3'
import { createPinia, setActivePinia } from 'pinia'
import type { IAuthUser } from '#shared/types/auth'
import { useAuthStore } from '~/stores/auth'

const ADA: IAuthUser = { id: 'usr_1', email: 'ada@example.com' }

const navigateTo = vi.hoisted(() => vi.fn())
mockNuxtImport('navigateTo', () => navigateTo)

/** Which routes are currently prepared to fail, reassigned per case. */
const failing = new Set<string>()

function endpoint(path: string, method: 'GET' | 'POST', user: IAuthUser | null = ADA) {
  registerEndpoint(path, {
    method,
    handler: () => {
      if (failing.has(path)) throw createError({ statusCode: 401, statusMessage: 'Nope' })
      return user === null ? { ok: true } : { user }
    },
  })
}

endpoint('/api/auth/me', 'GET')
endpoint('/api/auth/register', 'POST')
endpoint('/api/auth/login', 'POST')
endpoint('/api/auth/logout', 'POST', null)

const CREDENTIALS = { email: 'ada@example.com', password: 'correct-horse' }

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    failing.clear()
    navigateTo.mockClear()
  })

  it('starts signed out and uninitialized', () => {
    const store = useAuthStore()

    expect(store.user).toBeNull()
    expect(store.isAuthenticated).toBe(false)
    expect(store.initialized).toBe(false)
  })

  describe('fetchUser', () => {
    it('adopts the session the server reports', async () => {
      const store = useAuthStore()

      await store.fetchUser()

      expect(store.user).toEqual(ADA)
      expect(store.isAuthenticated).toBe(true)
    })

    /**
     * It runs before the app knows whether anyone is signed in, so a 401 is the *answer* rather
     * than an error — throwing here would turn "signed out" into a crash on first paint.
     */
    it('reads a rejection as signed out rather than throwing', async () => {
      failing.add('/api/auth/me')
      const store = useAuthStore()

      await expect(store.fetchUser()).resolves.toBeUndefined()

      expect(store.user).toBeNull()
      expect(store.isAuthenticated).toBe(false)
    })

    it('marks itself initialized either way', async () => {
      const signedIn = useAuthStore()
      await signedIn.fetchUser()
      expect(signedIn.initialized).toBe(true)

      setActivePinia(createPinia())
      failing.add('/api/auth/me')
      const signedOut = useAuthStore()
      await signedOut.fetchUser()
      expect(signedOut.initialized).toBe(true)
    })
  })

  describe('signing in', () => {
    it.each(['register', 'login'] as const)('adopts the user %s returns', async (action) => {
      const store = useAuthStore()

      await store[action](CREDENTIALS)

      expect(store.user).toEqual(ADA)
      expect(store.isAuthenticated).toBe(true)
    })

    /** Unlike `fetchUser`, these are user-initiated — the form has to be able to say why. */
    it.each([
      ['register', '/api/auth/register'],
      ['login', '/api/auth/login'],
    ] as const)('lets a failed %s reject', async (action, path) => {
      failing.add(path)
      const store = useAuthStore()

      await expect(store[action](CREDENTIALS)).rejects.toThrow()
      expect(store.user).toBeNull()
    })
  })

  describe('logout', () => {
    it('clears the session and leaves for the login page', async () => {
      const store = useAuthStore()
      await store.login(CREDENTIALS)
      expect(store.isAuthenticated).toBe(true)

      await store.logout()

      expect(store.user).toBeNull()
      expect(store.isAuthenticated).toBe(false)
      expect(navigateTo).toHaveBeenCalledWith('/auth/login')
    })

    /** The cookie is the server's to clear, so a failed request must not look signed out. */
    it('keeps the session when the request fails', async () => {
      const store = useAuthStore()
      await store.login(CREDENTIALS)

      failing.add('/api/auth/logout')
      await expect(store.logout()).rejects.toThrow()

      expect(store.user).toEqual(ADA)
      expect(navigateTo).not.toHaveBeenCalled()
    })
  })
})
