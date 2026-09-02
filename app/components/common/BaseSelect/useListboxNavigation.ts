import { onBeforeUnmount, nextTick, readonly, ref, watch } from 'vue'
import type { Ref } from 'vue'
import { optionValuesKey } from '~/components/common/BaseSelect/option-values-key'
import type { ISelectOption } from '~/types/select'

/** How far PageUp / PageDown jump, and how long a type-ahead buffer survives. */
const PAGE_STEP = 10
const TYPE_AHEAD_MS = 500

interface IUseListboxNavigationInput {
  options: () => ISelectOption[]
  /** The scrolling `role="listbox"` element, so the active option can be kept in view. */
  listRef: Ref<HTMLElement | undefined>
  /** `usePopover`'s `open` — the re-clamp below must not fire while the list is closed. */
  isOpen: Readonly<Ref<boolean>>
  /**
   * Whether a list that changed underneath *no* cursor should take one. True when the user's
   * own typing narrowed it, so `Enter` commits the top match; false for options merely
   * arriving, which would light a row up on their own.
   */
  shouldSeedCursor: () => boolean
}

/**
 * The cursor into a listbox: which option is active, how the keys move it, and keeping it
 * visible and valid as the list changes underneath.
 *
 * **Decomposition of `BaseSelect`, not a general-purpose composable.** One consumer; do not
 * reuse it expecting a stable contract. Extracted on SRP grounds rather than DRY — the same
 * standing as `useSelectOptions` (`docs/decisions.md`).
 */
export function useListboxNavigation(input: IUseListboxNavigationInput) {
  const activeIndex = ref(-1)

  /** Public because opening reveals the *selected* option without giving it the cursor. */
  function scrollIntoView(index: number) {
    input.listRef.value?.children[index]?.scrollIntoView({ block: 'nearest' })
  }

  /** The first option at or beyond `from` that can actually be chosen, walking in `step`. */
  function nextEnabledIndex(from: number, step: number): number {
    const options = input.options()

    for (let index = from; index >= 0 && index < options.length; index += step) {
      if (!options[index]?.disabled) return index
    }

    return -1
  }

  function setActive(index: number) {
    if (index < 0) return

    activeIndex.value = index
    void nextTick(() => scrollIntoView(activeIndex.value))
  }

  /** No wrap: a listbox that loops has no felt end, and Home/End are the way to the extremes. */
  function moveBy(delta: number) {
    const options = input.options()
    if (options.length === 0) return

    const step = delta > 0 ? 1 : -1
    const from =
      activeIndex.value < 0
        ? step > 0
          ? 0
          : options.length - 1
        : Math.max(0, Math.min(options.length - 1, activeIndex.value + delta))

    // Looking back the other way covers walking into a run of disabled options at either end
    const found = nextEnabledIndex(from, step)
    setActive(found >= 0 ? found : nextEnabledIndex(from, -step))
  }

  function moveToFirst() {
    setActive(nextEnabledIndex(0, 1))
  }

  function moveToLast() {
    setActive(nextEnabledIndex(input.options().length - 1, -1))
  }

  let typeBuffer = ''
  let typeTimer: ReturnType<typeof setTimeout> | undefined

  /**
   * A native `<select>` jumps to the first option starting with what you type, and replacing
   * it with a listbox deletes that silently. Only a select with no search box needs it —
   * where there is one, the search box *is* the answer.
   */
  function typeAhead(character: string) {
    clearTimeout(typeTimer)
    typeBuffer += character.toLowerCase()
    typeTimer = setTimeout(() => (typeBuffer = ''), TYPE_AHEAD_MS)

    setActive(
      input
        .options()
        .findIndex(
          (option) => !option.disabled && option.label.toLowerCase().startsWith(typeBuffer),
        ),
    )
  }

  function reset() {
    activeIndex.value = -1
    typeBuffer = ''
    clearTimeout(typeTimer)
  }

  // Keyed on the option *values*, not the array: a `props(field)` factory rebuilds the source
  // on every parent render, and resetting the highlight on that would fight the user.
  //
  // `flush: 'post'` because a typed term narrows the list in the tick that opens the panel,
  // and this watcher is created first — pre-flush it would see `isOpen` false and skip the
  // seed. Keying on `isOpen` is the same bug from the other side: opening would re-clamp a
  // cursor a printable key had just placed.
  watch(
    () => optionValuesKey(input.options()),
    () => {
      if (!input.isOpen.value) return
      // A changed list re-clamps a cursor; it does not *create* one, or an async select
      // highlights a row the moment its options land
      if (activeIndex.value < 0 && !input.shouldSeedCursor()) return

      activeIndex.value = input.options().length === 0 ? -1 : nextEnabledIndex(0, 1)
    },
    { flush: 'post' },
  )

  onBeforeUnmount(() => clearTimeout(typeTimer))

  return {
    activeIndex: readonly(activeIndex) as Readonly<Ref<number>>,
    PAGE_STEP,
    setActive,
    scrollIntoView,
    moveBy,
    moveToFirst,
    moveToLast,
    typeAhead,
    reset,
  }
}
