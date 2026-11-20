import { onScopeDispose, readonly, ref, watch } from 'vue'
import type { Ref, WatchSource } from 'vue'

interface IDelayedFlagOptions {
  delay?: number
  minDuration?: number
}

/** Long enough that a fast request never shows its indicator. */
export const INDICATOR_DELAY_MS = 300
/** Once shown, long enough that it does not blink out. */
export const INDICATOR_MIN_DURATION_MS = 500

/**
 * A copy of `source` for what the user sees: it turns on only if `source` stays on past `delay`,
 * and once on it stays on for at least `minDuration`. The source itself stays the truth for
 * anything that must act at once — disabling a button against a second submit.
 */
export function useDelayedFlag(
  source: WatchSource<boolean>,
  { delay = INDICATOR_DELAY_MS, minDuration = INDICATOR_MIN_DURATION_MS }: IDelayedFlagOptions = {},
): Readonly<Ref<boolean>> {
  const isShown = ref(false)

  let showTimer: ReturnType<typeof setTimeout> | undefined
  let minDurationTimer: ReturnType<typeof setTimeout> | undefined
  let shouldHideWhenAllowed = false

  function clearTimers() {
    clearTimeout(showTimer)
    clearTimeout(minDurationTimer)
    showTimer = undefined
    minDurationTimer = undefined
  }

  function show() {
    showTimer = undefined
    isShown.value = true
    minDurationTimer = setTimeout(() => {
      minDurationTimer = undefined
      if (shouldHideWhenAllowed) isShown.value = false
    }, minDuration)
  }

  watch(
    source,
    (isOn) => {
      // Server render has no timers to clear: it shows the idle state and the client takes over
      if (import.meta.server) return

      if (isOn) {
        shouldHideWhenAllowed = false
        if (!isShown.value && showTimer === undefined) showTimer = setTimeout(show, delay)
        return
      }

      clearTimeout(showTimer)
      showTimer = undefined
      if (minDurationTimer === undefined) isShown.value = false
      else shouldHideWhenAllowed = true
    },
    { immediate: true },
  )

  onScopeDispose(clearTimers)

  return readonly(isShown)
}
