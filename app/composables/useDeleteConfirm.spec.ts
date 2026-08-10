import { describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { useDeleteConfirm } from '~/composables/useDeleteConfirm'

interface ITable {
  id: string
  name: string
}

const TABLE: ITable = { id: 'tbl_1', name: 'Deals' }

/** `confirmLabel` is a `computed`, so the composable needs a scope to own it. */
function setup(remove: (target: ITable) => Promise<void>) {
  const scope = effectScope()
  const composable = scope.run(() => useDeleteConfirm(remove))!

  return { ...composable, stop: () => scope.stop() }
}

describe('useDeleteConfirm', () => {
  it('starts with no target and nothing pending', () => {
    const confirmer = setup(vi.fn())

    expect(confirmer.target.value).toBeNull()
    expect(confirmer.pending.value).toBe(false)
    expect(confirmer.confirmLabel.value).toBe('Delete')

    confirmer.stop()
  })

  it('does nothing when confirmed with no target', async () => {
    const remove = vi.fn()
    const confirmer = setup(remove)

    await confirmer.confirm()

    expect(remove).not.toHaveBeenCalled()
    expect(confirmer.pending.value).toBe(false)

    confirmer.stop()
  })

  it('passes the target to remove and clears it on success', async () => {
    const remove = vi.fn(async () => {})
    const confirmer = setup(remove)

    confirmer.target.value = TABLE
    await confirmer.confirm()

    expect(remove).toHaveBeenCalledWith(TABLE)
    expect(confirmer.target.value).toBeNull()
    expect(confirmer.pending.value).toBe(false)

    confirmer.stop()
  })

  /**
   * The reason the target is cleared after the await rather than before it: clearing first
   * would dismiss the dialog, and a failed request would leave the user with no way back to
   * the thing they were trying to delete and no statement that it did not happen.
   *
   * It **does not re-throw.** Every call site binds `confirm` to a template's `@confirm`, so
   * a rejection had nobody to catch it and became an unhandled promise rejection while the
   * dialog said nothing (`docs/decisions.md`).
   */
  it('keeps the target when remove rejects, and surfaces the reason', async () => {
    const remove = vi.fn(async () => {
      throw { data: { statusMessage: 'Remove the field “owner” first' } }
    })
    const confirmer = setup(remove)

    confirmer.target.value = TABLE
    await confirmer.confirm()

    expect(confirmer.target.value).toBe(TABLE)
    expect(confirmer.pending.value).toBe(false)
    expect(confirmer.error.value).toBe('Remove the field “owner” first')

    confirmer.stop()
  })

  /** An error the API did not explain still says *something* — never an empty box. */
  it('falls back to the generic message when the failure carries none', async () => {
    const confirmer = setup(
      vi.fn(async () => {
        throw new Error('socket hang up')
      }),
    )

    confirmer.target.value = TABLE
    await confirmer.confirm()

    expect(confirmer.error.value).toBe('Something went wrong. Please try again.')

    confirmer.stop()
  })

  /** A retry keeps the same target, so the watch below cannot be what clears the message. */
  it('clears the message when the same target is retried', async () => {
    let fail = true
    const confirmer = setup(
      vi.fn(async () => {
        if (fail) throw new Error('nope')
      }),
    )

    confirmer.target.value = TABLE
    await confirmer.confirm()
    expect(confirmer.error.value).not.toBeNull()

    fail = false
    await confirmer.confirm()

    expect(confirmer.error.value).toBeNull()
    expect(confirmer.target.value).toBeNull()

    confirmer.stop()
  })

  it('clears the message when the dialog is dismissed', async () => {
    const confirmer = setup(
      vi.fn(async () => {
        throw new Error('nope')
      }),
    )

    confirmer.target.value = TABLE
    await confirmer.confirm()
    expect(confirmer.error.value).not.toBeNull()

    confirmer.cancel()
    await nextTick()

    expect(confirmer.error.value).toBeNull()

    confirmer.stop()
  })

  it('marks itself pending for the duration of the request', async () => {
    let release: () => void = () => {}
    const remove = vi.fn(() => new Promise<void>((resolve) => (release = resolve)))
    const confirmer = setup(remove)

    confirmer.target.value = TABLE
    const settled = confirmer.confirm()

    expect(confirmer.pending.value).toBe(true)
    expect(confirmer.confirmLabel.value).toBe('Deleting…')

    release()
    await settled

    expect(confirmer.pending.value).toBe(false)
    expect(confirmer.confirmLabel.value).toBe('Delete')

    confirmer.stop()
  })

  it('drops the target on cancel without calling remove', () => {
    const remove = vi.fn()
    const confirmer = setup(remove)

    confirmer.target.value = TABLE
    confirmer.cancel()

    expect(confirmer.target.value).toBeNull()
    expect(remove).not.toHaveBeenCalled()

    confirmer.stop()
  })
})
