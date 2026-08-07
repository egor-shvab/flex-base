import { describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
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
   */
  it('keeps the target when remove rejects, so the dialog stays open', async () => {
    const remove = vi.fn(async () => {
      throw new Error('409')
    })
    const confirmer = setup(remove)

    confirmer.target.value = TABLE
    await expect(confirmer.confirm()).rejects.toThrow('409')

    expect(confirmer.target.value).toBe(TABLE)
    expect(confirmer.pending.value).toBe(false)

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
