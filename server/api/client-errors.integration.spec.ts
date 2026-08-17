import { beforeEach, describe, expect, it, vi } from 'vitest'
import clientErrorsPost from '#server/api/client-errors.post'
import type { IAuthUser } from '#shared/types/auth'
import { CLIENT_ERROR_MAX_BYTES, CLIENT_ERROR_RATE_LIMIT } from '#shared/constants/error-report'
import { testEvent } from '~~/test/integration/event'
import { createUser } from '~~/test/integration/seed'

/**
 * The app's one write surface open to anyone, so what is proved here is mostly what it
 * **refuses**. The recorder is stubbed: what reaches the file is the unit suite's subject
 * (`error-log.spec.ts` asserts the serialized line), while what only a real request can answer
 * is whether the guards fire before the body is read and whether the user comes from the cookie.
 */
const recorded: unknown[] = []

vi.mock('#server/utils/error-log-file', () => ({
  recordErrorEntry: (entry: unknown) => recorded.push(entry),
}))

const report = {
  name: 'TypeError',
  message: 'x is not a function',
  stack: 'TypeError: x is not a function\n    at Foo',
  path: '/tables/tbl_1',
}

/**
 * A real request, with the `content-length` the handler checks before reading anything.
 *
 * **Each case gets its own address.** The limiter is module state by design — it has to outlive a
 * request to count anything — so cases sharing one address would spend each other's allowance and
 * the order of this file would decide whether it passed.
 */
let address = 0

function post(body: unknown, user: IAuthUser | null = null, ip = `10.0.0.${address}`) {
  return clientErrorsPost(testEvent({ user, method: 'POST', body, ip }))
}

let ada: IAuthUser

beforeEach(async () => {
  recorded.length = 0
  address += 1
  ada = await createUser()
})

describe('reporting a client error', () => {
  it('accepts an anonymous report — an error on the login page is one worth having', async () => {
    await expect(post(report)).resolves.toEqual({ ok: true })

    expect(recorded).toHaveLength(1)
    expect(recorded[0]).toMatchObject({ source: 'client', name: 'TypeError', userId: null })
  })

  /** The id comes from the cookie the middleware resolved, so a body cannot claim to be anyone. */
  it('attaches the signed-in user itself, never taking one from the body', async () => {
    await post({ ...report, userId: 'usr_someone_else' }, ada)

    expect(recorded[0]).toMatchObject({ userId: ada.id })
    expect(JSON.stringify(recorded[0])).not.toContain('usr_someone_else')
  })

  it('records the reported path with any query string cut off it', async () => {
    await post({ ...report, path: '/tables/tbl_1?search=acme' }, ada)

    expect(recorded[0]).toMatchObject({ path: '/tables/tbl_1' })
    expect(JSON.stringify(recorded[0])).not.toContain('acme')
  })

  describe('what it refuses', () => {
    it('400s on a malformed report, recording nothing', async () => {
      await expect(post({ name: '', message: 'boom', path: '/x' })).rejects.toMatchObject({
        statusCode: 400,
      })
      expect(recorded).toHaveLength(0)
    })

    /** Rooted, so an absolute URL to another origin cannot be logged as though it were a route. */
    it('400s on a path that is not rooted', async () => {
      await expect(post({ ...report, path: 'https://evil.test/x' })).rejects.toMatchObject({
        statusCode: 400,
      })
    })

    it('413s on a body past the cap, before reading it', async () => {
      const huge = { ...report, stack: 'x'.repeat(CLIENT_ERROR_MAX_BYTES + 1) }

      await expect(post(huge)).rejects.toMatchObject({ statusCode: 413 })
      expect(recorded).toHaveLength(0)
    })

    /**
     * The load-bearing half of the cap. Refusing only an oversized *declared* length would leave
     * chunked encoding as an uncapped path straight into memory, so a request that declares no
     * length at all is refused outright.
     */
    it('411s when no length is declared, so chunked encoding is not an uncapped path', async () => {
      const event = testEvent({ method: 'POST', ip: `10.0.0.${address}` })
      event.node.req.headers['content-length'] = undefined

      await expect(clientErrorsPost(event)).rejects.toMatchObject({ statusCode: 411 })
      expect(recorded).toHaveLength(0)
    })

    it('429s once one address is past its allowance in a window', async () => {
      for (let call = 0; call < CLIENT_ERROR_RATE_LIMIT; call += 1) {
        await expect(post(report)).resolves.toEqual({ ok: true })
      }

      await expect(post(report)).rejects.toMatchObject({ statusCode: 429 })
      expect(recorded).toHaveLength(CLIENT_ERROR_RATE_LIMIT)
    })
  })
})
