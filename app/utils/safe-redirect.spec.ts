import { describe, expect, it } from 'vitest'
import { resolveSafeRedirect } from '~/utils/safe-redirect'

describe('resolveSafeRedirect — internal paths pass through', () => {
  it('keeps an app path', () => {
    expect(resolveSafeRedirect('/tables/abc/records')).toBe('/tables/abc/records')
  })

  it('keeps the query and fragment, which carry a filtered view', () => {
    expect(resolveSafeRedirect('/tables/abc/records?stage=Won&page=2#top')).toBe(
      '/tables/abc/records?stage=Won&page=2#top',
    )
  })

  it('keeps the root', () => {
    expect(resolveSafeRedirect('/')).toBe('/')
  })
})

describe('resolveSafeRedirect — anything leaving the app becomes the root', () => {
  it('refuses a protocol-relative path', () => {
    expect(resolveSafeRedirect('//evil.com')).toBe('/')
    expect(resolveSafeRedirect('//evil.com/path')).toBe('/')
  })

  it('refuses the backslash form, which browsers normalise to the one above', () => {
    expect(resolveSafeRedirect('/\\evil.com')).toBe('/')
    expect(resolveSafeRedirect('/\\/evil.com')).toBe('/')
    expect(resolveSafeRedirect('/\\\\evil.com')).toBe('/')
  })

  it('refuses an absolute URL', () => {
    expect(resolveSafeRedirect('https://evil.com')).toBe('/')
    expect(resolveSafeRedirect('http://evil.com/tables')).toBe('/')
  })

  it('refuses a bare host and a relative path', () => {
    expect(resolveSafeRedirect('evil.com')).toBe('/')
    expect(resolveSafeRedirect('tables/abc')).toBe('/')
    expect(resolveSafeRedirect('../tables')).toBe('/')
  })

  it('refuses a scheme that is not navigation at all', () => {
    expect(resolveSafeRedirect('javascript:alert(1)')).toBe('/')
    expect(resolveSafeRedirect('data:text/html,<script>alert(1)</script>')).toBe('/')
  })
})

describe('resolveSafeRedirect — non-string input', () => {
  it('refuses an absent or empty param', () => {
    expect(resolveSafeRedirect(undefined)).toBe('/')
    expect(resolveSafeRedirect(null)).toBe('/')
    expect(resolveSafeRedirect('')).toBe('/')
  })

  it('refuses a repeated param, which a router hands over as an array', () => {
    expect(resolveSafeRedirect(['/tables/abc', '//evil.com'])).toBe('/')
  })

  it('refuses any other type', () => {
    expect(resolveSafeRedirect(42)).toBe('/')
    expect(resolveSafeRedirect({ toString: () => '/tables/abc' })).toBe('/')
  })
})
