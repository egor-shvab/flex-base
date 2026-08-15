import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError } from 'h3'
import { createPinia, setActivePinia } from 'pinia'
import type { RouteLocationNormalized } from 'vue-router'
import type { IAuthUser } from '#shared/types/auth'
import authGlobal from '~/middleware/auth.global'
import { useAuthStore } from '~/stores/auth'

const ADA: IAuthUser = { id: 'usr_1', email: 'ada@example.com' }

const navigateTo = vi.hoisted(() => vi.fn())
mockNuxtImport('navigateTo', () => navigateTo)

/** Whether `/api/auth/me` currently reports a session, reassigned per case. */
let signedIn = false

registerEndpoint('/api/auth/me', {
  method: 'GET',
  handler: () => {
    if (!signedIn) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    return { user: ADA }
  },
})

/**
 * Only the two fields the guard reads. A real `RouteLocationNormalized` carries far more, and
 * building one would be describing vue-router rather than this middleware.
 */
function route(fullPath: string): RouteLocationNormalized {
  const [path = '/', search] = fullPath.split('?')
  const query = Object.fromEntries(new URLSearchParams(search))

  return { path, fullPath, query } as unknown as RouteLocationNormalized
}

/** The guard takes `(to, from)`; `from` is never read, so it is the same stub. */
const guard = async (to: string) => authGlobal(route(to), route('/'))

beforeEach(() => {
  setActivePinia(createPinia())
  navigateTo.mockReset()
  signedIn = false
})

describe('restoring the session', () => {
  it('asks the server who this is on the first navigation', async () => {
    signedIn = true
    await guard('/')

    expect(useAuthStore().user).toEqual(ADA)
  })

  it('does not ask again once initialized, so every route change is not a round trip', async () => {
    const auth = useAuthStore()
    const fetchUser = vi.spyOn(auth, 'fetchUser')
    auth.initialized = true
    auth.user = ADA

    await guard('/tables/tbl_1')

    expect(fetchUser).not.toHaveBeenCalled()
  })

  it('treats a rejected session as signed out rather than failing the navigation', async () => {
    // The store swallows the 401 — the guard's job is to redirect, not to surface an error
    await expect(guard('/')).resolves.not.toThrow()

    const auth = useAuthStore()
    expect(auth.user).toBeNull()
    expect(auth.initialized).toBe(true)
  })
})

describe('an anonymous visitor', () => {
  it('is sent to the login page', async () => {
    await guard('/tables/tbl_1')

    expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({ path: '/auth/login' }))
  })

  /** So signing in lands back on the filtered view the link pointed at, not on the dashboard. */
  it('carries where it was going, query and all', async () => {
    await guard('/tables/tbl_1?stage=Won&page=2')

    expect(navigateTo).toHaveBeenCalledWith({
      path: '/auth/login',
      query: { redirect: '/tables/tbl_1?stage=Won&page=2' },
    })
  })

  it('carries no redirect from the root, which is where login lands anyway', async () => {
    await guard('/')

    expect(navigateTo).toHaveBeenCalledWith({ path: '/auth/login', query: {} })
  })

  it('is left alone on the auth pages themselves, or it would loop', async () => {
    await guard('/auth/login')
    await guard('/auth/register')

    expect(navigateTo).not.toHaveBeenCalled()
  })
})

describe('a signed-in visitor', () => {
  beforeEach(() => {
    signedIn = true
  })

  it('is left alone on an app route', async () => {
    await guard('/tables/tbl_1')

    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('is bounced off the login page to the root', async () => {
    await guard('/auth/login')

    expect(navigateTo).toHaveBeenCalledWith('/')
  })

  it('is bounced to where it was originally headed', async () => {
    await guard('/auth/login?redirect=/tables/tbl_1')

    expect(navigateTo).toHaveBeenCalledWith('/tables/tbl_1')
  })

  /**
   * The redirect is attacker-controlled, so it goes through `resolveSafeRedirect` — an
   * off-site target is not somewhere this app sends anyone.
   */
  it('refuses to be bounced off-site', async () => {
    await guard('/auth/login?redirect=https://evil.example.com')

    expect(navigateTo).toHaveBeenCalledWith('/')
  })
})
