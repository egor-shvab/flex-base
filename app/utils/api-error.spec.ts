import { describe, expect, it } from 'vitest'
import { getApiErrorMessage, isWorkspaceMissing, toPageError } from '~/utils/api-error'

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
    expect(toPageError({ statusCode: 404 })).toMatchObject({
      statusCode: 404,
      statusMessage: 'We couldn’t find that table.',
    })
  })

  it('names the workspace instead when that is what the server could not find', () => {
    expect(
      toPageError({
        statusCode: 404,
        data: { statusMessage: 'x', data: { missing: 'workspace' } },
      }),
    ).toMatchObject({ statusCode: 404, statusMessage: 'We couldn’t find that workspace.' })
  })

  it('goes by what the server says is missing, never by its message', () => {
    expect(
      toPageError({ statusCode: 404, data: { statusMessage: 'Workspace not found' } }),
    ).toMatchObject({ statusCode: 404, statusMessage: 'We couldn’t find that table.' })
  })

  it('blames the address, not the table, for anything else', () => {
    expect(toPageError({ statusCode: 400 })).toMatchObject({
      statusCode: 400,
      statusMessage: 'That web address could not be read.',
    })
  })

  it('forwards the status it was given', () => {
    expect(toPageError({ statusCode: 400 }).statusCode).toBe(400)
    expect(toPageError({ statusCode: 503 }).statusCode).toBe(503)
  })

  it('owns a server fault rather than blaming the address', () => {
    expect(toPageError({ statusCode: 500 })).toMatchObject({
      statusCode: 500,
      statusMessage: 'Something went wrong at our end.',
    })
    expect(toPageError({ statusCode: 503 }).statusMessage).toBe('Something went wrong at our end.')
  })

  it('is fatal, so a client-side navigation shows it too', () => {
    expect(toPageError({ statusCode: 404 }).fatal).toBe(true)
    expect(toPageError({ statusCode: 500 }).fatal).toBe(true)
  })

  it('defaults to 404 when the failure carried no status', () => {
    expect(toPageError({})).toMatchObject({
      statusCode: 404,
      statusMessage: 'We couldn’t find that table.',
    })
  })
})

describe('isWorkspaceMissing', () => {
  const marked = { data: { statusMessage: 'Workspace not found', data: { missing: 'workspace' } } }

  it('is true for a 404 the server marked as the workspace’s', () => {
    expect(isWorkspaceMissing({ statusCode: 404, ...marked })).toBe(true)
  })

  it('is false for a table’s 404, another status, or no error shape at all', () => {
    expect(
      isWorkspaceMissing({ statusCode: 404, data: { statusMessage: 'Table not found' } }),
    ).toBe(false)
    expect(isWorkspaceMissing({ statusCode: 403, ...marked })).toBe(false)
    expect(isWorkspaceMissing(null)).toBe(false)
    expect(isWorkspaceMissing('boom')).toBe(false)
  })
})

describe('reading a fetch error', () => {
  /** `ofetch`'s `FetchError` serves `data` from a prototype getter, which a spread drops. */
  class GetterFailure {
    readonly statusCode = 404
    get data() {
      return { statusMessage: 'Workspace not found', data: { missing: 'workspace' } }
    }
  }

  it('finds the workspace marker behind a getter', () => {
    expect(isWorkspaceMissing(new GetterFailure())).toBe(true)
    expect(toPageError(new GetterFailure()).statusMessage).toBe('We couldn’t find that workspace.')
  })
})
