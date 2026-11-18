import { describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { z } from 'zod'
import { useSavedForm } from '~/composables/useSavedForm'

const resyncAccess = vi.hoisted(() => vi.fn())

vi.mock('~/composables/useAccessResync', () => ({
  useAccessResync: () => ({ resyncAccess }),
}))

const SCHEMA = z.object({ name: z.string().min(1, 'Required'), tags: z.array(z.string()) })

type TValues = z.infer<typeof SCHEMA>

/** Tags in any order save the same. */
const isSame = (a: TValues, b: TValues) =>
  a.name === b.name && [...a.tags].sort().join() === [...b.tags].sort().join()

function setup(save: (values: TValues) => Promise<TValues>) {
  const scope = effectScope()
  const composable = scope.run(() =>
    useSavedForm({ schema: SCHEMA, initial: { name: 'Deals', tags: ['a', 'b'] }, save, isSame }),
  )!
  return { ...composable, stop: () => scope.stop() }
}

describe('useSavedForm', () => {
  it('is clean until the form differs from what is saved, by the caller’s own measure', () => {
    const form = setup(vi.fn())

    expect(form.isDirty.value).toBe(false)
    form.form.tags = ['b', 'a']
    expect(form.isDirty.value).toBe(false)
    form.form.name = 'Leads'
    expect(form.isDirty.value).toBe(true)

    form.stop()
  })

  it('takes what the save returns as both the form and the saved values', async () => {
    const form = setup(async (values) => ({ ...values, name: values.name.toUpperCase() }))

    form.form.name = 'Leads'
    await form.submit()

    expect(form.form.name).toBe('LEADS')
    expect(form.savedValues.value.name).toBe('LEADS')
    expect(form.isDirty.value).toBe(false)
    expect(form.hasSaved.value).toBe(true)

    form.stop()
  })

  it('discards back to the last save, which no later edit reaches into', async () => {
    const form = setup(async (values) => values)

    form.form.tags.push('c')
    await form.submit()
    form.form.tags.push('d')
    form.discard()

    expect(form.form.tags).toEqual(['a', 'b', 'c'])
    expect(form.hasSaved.value).toBe(false)

    form.stop()
  })

  it('marks a save refused for an older version as stale, and only that one', async () => {
    const form = setup(vi.fn().mockRejectedValueOnce({ statusCode: 412 }).mockRejectedValue({}))

    form.form.name = 'Leads'
    await form.submit()
    expect(form.isStale.value).toBe(true)
    expect(form.isDirty.value).toBe(true)

    await form.submit()
    expect(form.isStale.value).toBe(false)

    form.stop()
  })
})
