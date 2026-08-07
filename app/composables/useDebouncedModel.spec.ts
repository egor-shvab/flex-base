import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import type { Ref } from 'vue'
import { useDebouncedModel } from '~/composables/useDebouncedModel'

interface IOptions {
  delay?: number
  normalize?: (value: string) => string
}

/**
 * Every case runs inside an `effectScope` so the two `watch`es have an owner and are torn down
 * afterwards — without one they outlive the case and a later assertion sees an earlier test's
 * writes. `watch` is async by default, so acting and asserting are always a `nextTick` apart.
 */
async function withModel(
  initial: string,
  options: IOptions,
  run: (model: Ref<string>, draft: Ref<string>) => Promise<void>,
) {
  const scope = effectScope()
  const model = ref(initial)

  try {
    const draft = scope.run(() => useDebouncedModel(model, options))!
    await run(model, draft)
  } finally {
    scope.stop()
  }
}

describe('useDebouncedModel', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('starts as a copy of the model', async () => {
    await withModel('initial', {}, async (model, draft) => {
      expect(draft.value).toBe('initial')
      expect(model.value).toBe('initial')
    })
  })

  it('collapses a burst of edits into a single write', async () => {
    await withModel('', {}, async (model, draft) => {
      for (const value of ['a', 'ab', 'abc']) {
        draft.value = value
        await nextTick()
        vi.advanceTimersByTime(100)
      }

      // 300ms of typing, but every keystroke restarted the timer
      expect(model.value).toBe('')

      vi.advanceTimersByTime(300)
      expect(model.value).toBe('abc')
    })
  })

  it('defaults to a 300ms delay', async () => {
    await withModel('', {}, async (model, draft) => {
      draft.value = 'typed'
      await nextTick()

      vi.advanceTimersByTime(299)
      expect(model.value).toBe('')

      vi.advanceTimersByTime(1)
      expect(model.value).toBe('typed')
    })
  })

  it('honours a custom delay', async () => {
    await withModel('', { delay: 50 }, async (model, draft) => {
      draft.value = 'typed'
      await nextTick()

      vi.advanceTimersByTime(50)
      expect(model.value).toBe('typed')
    })
  })

  // A zero delay deferred by a tick would make every undebounced consumer's model lag its
  // input by a frame, so it writes inline rather than through a 0ms timer
  it('writes through without a timer when the delay is 0', async () => {
    await withModel('', { delay: 0 }, async (model, draft) => {
      draft.value = 'typed'
      await nextTick()

      expect(model.value).toBe('typed')
    })
  })

  it('applies normalize on the way to the model but leaves the draft alone', async () => {
    await withModel('', { normalize: (value) => value.trim() }, async (model, draft) => {
      draft.value = '  spaced  '
      await nextTick()
      vi.advanceTimersByTime(300)

      expect(model.value).toBe('spaced')
      // The user may still be mid-word — trimming what they see would move their cursor
      expect(draft.value).toBe('  spaced  ')
    })
  })

  it('pushes an outside model change into the draft', async () => {
    await withModel('initial', {}, async (model, draft) => {
      // Clear all, a shared URL, the back button — the model has other authors
      model.value = 'from elsewhere'
      await nextTick()

      expect(draft.value).toBe('from elsewhere')
    })
  })

  it('does not re-schedule a write when the model pushed the value in', async () => {
    await withModel('initial', {}, async (model, draft) => {
      model.value = 'from elsewhere'
      await nextTick()
      expect(draft.value).toBe('from elsewhere')

      // Nothing was queued by the echo, so a later outside write survives the debounce window
      model.value = 'newer still'
      await nextTick()
      vi.advanceTimersByTime(300)

      expect(model.value).toBe('newer still')
    })
  })

  it('writes nothing when the draft normalizes back to the model value', async () => {
    await withModel('word', { normalize: (value) => value.trim() }, async (model, draft) => {
      // Typing a trailing space normalizes to exactly what the model already holds
      draft.value = 'word '
      await nextTick()
      vi.advanceTimersByTime(300)

      expect(model.value).toBe('word')
      expect(draft.value).toBe('word ')
    })
  })

  it('stops tracking the model once its scope is disposed', async () => {
    const scope = effectScope()
    const model = ref('initial')
    const draft = scope.run(() => useDebouncedModel(model))!

    scope.stop()

    model.value = 'from elsewhere'
    await nextTick()

    expect(draft.value).toBe('initial')
  })
})
