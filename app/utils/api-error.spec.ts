import { describe, expect, it } from 'vitest'
import { getApiErrorMessage, toPageError } from '~/utils/api-error'

const GENERIC = 'Something went wrong. Please try again.'

describe('getApiErrorMessage', () => {
  it('prefers the statusMessage Nitro’s createError sets', () => {
    const error = { data: { statusMessage: 'That email is already registered.' } }

    expect(getApiErrorMessage(error)).toBe('That email is already registered.')
  })

  it('takes statusMessage over message when both are present', () => {
    const error = { data: { statusMessage: 'Name already taken', message: 'Conflict' } }

    expect(getApiErrorMessage(error)).toBe('Name already taken')
  })

  it('falls back to message when there is no statusMessage', () => {
    expect(getApiErrorMessage({ data: { message: 'Conflict' } })).toBe('Conflict')
  })

  /**
   * `??` alone skips only `null`/`undefined`, so an empty `statusMessage` would win the chain
   * and render an empty error box. Blank counts as absent.
   */
  it('treats a blank statusMessage as absent rather than as an answer', () => {
    expect(getApiErrorMessage({ data: { statusMessage: '', message: 'Conflict' } })).toBe(
      'Conflict',
    )
    expect(getApiErrorMessage({ data: { statusMessage: '   ', message: 'Conflict' } })).toBe(
      'Conflict',
    )
  })

  it('reaches the generic copy when every candidate is blank', () => {
    expect(getApiErrorMessage({ data: { statusMessage: '', message: '' } })).toBe(GENERIC)
  })

  /** `data` is untyped at runtime, so a non-string must not escape a `string`-typed function. */
  it('ignores a non-string message', () => {
    expect(getApiErrorMessage({ data: { statusMessage: 500 } })).toBe(GENERIC)
    expect(getApiErrorMessage({ data: { statusMessage: { text: 'nope' } } })).toBe(GENERIC)
  })

  it('falls back for anything that is not a fetch error at all', () => {
    expect(getApiErrorMessage(null)).toBe(GENERIC)
    expect(getApiErrorMessage(undefined)).toBe(GENERIC)
    expect(getApiErrorMessage({})).toBe(GENERIC)
    expect(getApiErrorMessage(new Error('TypeError: failed to fetch'))).toBe(GENERIC)
    expect(getApiErrorMessage('a bare string')).toBe(GENERIC)
  })
})

describe('toPageError', () => {
  it('names the cause for a 404, which is the one status that tells us what was wrong', () => {
    expect(toPageError({ statusCode: 404 })).toEqual({
      statusCode: 404,
      statusMessage: 'We couldn’t find that table.',
    })
  })

  /**
   * Hard-coding the not-found wording here makes a malformed `?sort=` render as a server error
   * claiming a table that had just loaded does not exist, so a 400 forwards its code and
   * asserts no cause.
   */
  it('blames the address, not the table, for anything else', () => {
    expect(toPageError({ statusCode: 400 })).toEqual({
      statusCode: 400,
      statusMessage: 'That web address could not be read.',
    })
  })

  it('forwards the status it was given', () => {
    expect(toPageError({ statusCode: 400 }).statusCode).toBe(400)
    expect(toPageError({ statusCode: 503 }).statusCode).toBe(503)
  })

  /**
   * A 500 must not take the 400 wording, which describes a status it is not: the records page
   * wraps its record fetch in the same `useAsyncData`, so a failing endpoint lands here and
   * would blame the user's link for a fault at our end.
   */
  it('owns a server fault rather than blaming the address', () => {
    expect(toPageError({ statusCode: 500 })).toEqual({
      statusCode: 500,
      statusMessage: 'Something went wrong at our end.',
    })
    expect(toPageError({ statusCode: 503 }).statusMessage).toBe('Something went wrong at our end.')
  })

  it('defaults to 404 when the failure carried no status', () => {
    expect(toPageError({})).toEqual({
      statusCode: 404,
      statusMessage: 'We couldn’t find that table.',
    })
  })
})
