import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import type { Ref } from 'vue'
import { useDelayedFlag } from '~/composables/useDelayedFlag'

async function withFlag(
  initial: boolean,
  run: (source: Ref<boolean>, isShown: Readonly<Ref<boolean>>) => Promise<void>,
) {
  const scope = effectScope()
  const source = ref(initial)

  try {
    const isShown = scope.run(() => useDelayedFlag(source, { delay: 300, minDuration: 500 }))!
    await run(source, isShown)
  } finally {
    scope.stop()
  }
}

async function setSource(source: Ref<boolean>, value: boolean) {
  source.value = value
  await nextTick()
}

describe('useDelayedFlag', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('never shows for a source that turns off before the delay', async () => {
    await withFlag(false, async (source, isShown) => {
      await setSource(source, true)
      vi.advanceTimersByTime(299)
      await setSource(source, false)
      vi.advanceTimersByTime(1000)

      expect(isShown.value).toBe(false)
    })
  })

  it('shows once the source has stayed on past the delay', async () => {
    await withFlag(false, async (source, isShown) => {
      await setSource(source, true)
      vi.advanceTimersByTime(299)
      expect(isShown.value).toBe(false)

      vi.advanceTimersByTime(1)
      expect(isShown.value).toBe(true)
    })
  })

  it('stays shown for the minimum duration after an early turn-off', async () => {
    await withFlag(false, async (source, isShown) => {
      await setSource(source, true)
      vi.advanceTimersByTime(320)
      await setSource(source, false)

      vi.advanceTimersByTime(479)
      expect(isShown.value).toBe(true)

      vi.advanceTimersByTime(1)
      expect(isShown.value).toBe(false)
    })
  })

  it('hides at once when the source turns off after the minimum duration', async () => {
    await withFlag(false, async (source, isShown) => {
      await setSource(source, true)
      vi.advanceTimersByTime(1000)
      await setSource(source, false)

      expect(isShown.value).toBe(false)
    })
  })

  it('stays shown when the source turns back on within the minimum duration', async () => {
    await withFlag(false, async (source, isShown) => {
      await setSource(source, true)
      vi.advanceTimersByTime(320)
      await setSource(source, false)
      await setSource(source, true)
      vi.advanceTimersByTime(1000)

      expect(isShown.value).toBe(true)
    })
  })

  it('starts its delay for a source already on', async () => {
    await withFlag(true, async (_source, isShown) => {
      expect(isShown.value).toBe(false)

      vi.advanceTimersByTime(300)
      expect(isShown.value).toBe(true)
    })
  })
})
