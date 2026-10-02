import { describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { useDeleteConfirm } from '~/composables/useDeleteConfirm'

interface ITable {
  id: string
  name: string
}

const TABLE: ITable = { id: 'tbl_1', name: 'Deals' }

function setup(remove: (target: ITable) => Promise<void>) {
  const scope = effectScope()
  const composable = scope.run(() => useDeleteConfirm(remove))!

  return { ...composable, stop: () => scope.stop() }
}

describe('useDeleteConfirm', () => {
  it('starts with no target and nothing pending', () => {
    const confirmer = setup(vi.fn())

    expect(confirmer.target.value).toBeNull()
    expect(confirmer.dialogProps.value.pending).toBe(false)
    expect(confirmer.dialogProps.value.confirmLabel).toBe('Delete')

    confirmer.stop()
  })

  it('does nothing when confirmed with no target', async () => {
    const remove = vi.fn()
    const confirmer = setup(remove)

    await confirmer.confirm()

    expect(remove).not.toHaveBeenCalled()
    expect(confirmer.dialogProps.value.pending).toBe(false)

    confirmer.stop()
  })

  it('passes the target to remove and clears it on success', async () => {
    const remove = vi.fn(async () => {})
    const confirmer = setup(remove)

    confirmer.target.value = TABLE
    await confirmer.confirm()

    expect(remove).toHaveBeenCalledWith(TABLE)
    expect(confirmer.target.value).toBeNull()
    expect(confirmer.dialogProps.value.pending).toBe(false)

    confirmer.stop()
  })

  it('keeps the target when remove rejects, and surfaces the reason', async () => {
    const remove = vi.fn(async () => {
      throw { data: { statusMessage: 'Remove the field “owner” first' } }
    })
    const confirmer = setup(remove)

    confirmer.target.value = TABLE
    await confirmer.confirm()

    expect(confirmer.target.value).toBe(TABLE)
    expect(confirmer.dialogProps.value.pending).toBe(false)
    expect(confirmer.dialogProps.value.error).toBe('Remove the field “owner” first')

    confirmer.stop()
  })

  it('falls back to the generic message when the failure carries none', async () => {
    const confirmer = setup(
      vi.fn(async () => {
        throw new Error('socket hang up')
      }),
    )

    confirmer.target.value = TABLE
    await confirmer.confirm()

    expect(confirmer.dialogProps.value.error).toBe('Something went wrong. Please try again.')

    confirmer.stop()
  })

  it('clears the message when the same target is retried', async () => {
    let fail = true
    const confirmer = setup(
      vi.fn(async () => {
        if (fail) throw new Error('nope')
      }),
    )

    confirmer.target.value = TABLE
    await confirmer.confirm()
    expect(confirmer.dialogProps.value.error).not.toBeNull()

    fail = false
    await confirmer.confirm()

    expect(confirmer.dialogProps.value.error).toBeNull()
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
    expect(confirmer.dialogProps.value.error).not.toBeNull()

    confirmer.cancel()
    await nextTick()

    expect(confirmer.dialogProps.value.error).toBeNull()

    confirmer.stop()
  })

  it('marks itself pending for the duration of the request', async () => {
    let release: () => void = () => {}
    const remove = vi.fn(() => new Promise<void>((resolve) => (release = resolve)))
    const confirmer = setup(remove)

    confirmer.target.value = TABLE
    const settled = confirmer.confirm()

    expect(confirmer.dialogProps.value.pending).toBe(true)
    expect(confirmer.dialogProps.value.confirmLabel).toBe('Delete')

    release()
    await settled

    expect(confirmer.dialogProps.value.pending).toBe(false)
    expect(confirmer.dialogProps.value.confirmLabel).toBe('Delete')

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
