import { expect, test } from '~~/test/e2e/setup/fixtures'

test.describe('the server’s own guards', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('a page and an API response both refuse framing by another site', async ({
    page,
    request,
  }) => {
    const pageHeaders = (await page.goto('/auth/login'))?.headers() ?? {}
    const apiHeaders = (await request.post('/api/auth/logout')).headers()

    for (const headers of [pageHeaders, apiHeaders]) {
      expect(headers['content-security-policy']).toContain("frame-ancestors 'self'")
      expect(headers['x-frame-options']).toBe('SAMEORIGIN')
      expect(headers['x-content-type-options']).toBe('nosniff')
      expect(headers['referrer-policy']).toBe('same-origin')
    }
  })

  test('an error response keeps Nitro’s stricter framing refusal', async ({ request }) => {
    const headers = (await request.get('/api/auth/me')).headers()

    expect(headers['x-frame-options']).toBe('DENY')
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'")
  })

  test('an oversized body is refused before anything reads it', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      headers: { 'content-type': 'application/json' },
      data: JSON.stringify({ email: 'a@example.com', password: 'x'.repeat(1024 * 1024) }),
    })

    expect(response.status()).toBe(413)
  })
})
