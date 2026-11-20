import { describe, expect, it, vi } from 'vitest'
import { useServerAction } from '~/composables/useServerAction'

const resyncAccess = vi.hoisted(() => vi.fn())

vi.mock('~/composables/useAccessResync', () => ({
  useAccessResync: () => ({ resyncAccess }),
}))

describe('useServerAction', () => {
  it('reports success, pending only while the action runs', async () => {
    const { isPending, error, run } = useServerAction()
    let finish: () => void = () => {}

    const running = run(() => new Promise<void>((resolve) => (finish = resolve)))
    expect(isPending.value).toBe(true)

    finish()
    await expect(running).resolves.toBe(true)
    expect(isPending.value).toBe(false)
    expect(error.value).toBe('')
  })

  it('keeps the server’s message and hands the failure to the access resync', async () => {
    resyncAccess.mockClear()
    const failure = { statusCode: 403, data: { statusMessage: 'Not allowed here' } }
    const { isPending, error, run } = useServerAction()

    await expect(run(() => Promise.reject(failure))).resolves.toBe(false)

    expect(error.value).toBe('Not allowed here')
    expect(isPending.value).toBe(false)
    expect(resyncAccess).toHaveBeenCalledWith(failure)
  })

  it('clears the last message when it runs again', async () => {
    const { error, run } = useServerAction()
    await run(() => Promise.reject(new Error('offline')))

    await run(() => Promise.resolve())

    expect(error.value).toBe('')
  })
})
