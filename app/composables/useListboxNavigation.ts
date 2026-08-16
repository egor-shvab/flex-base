import { onBeforeUnmount, nextTick, readonly, ref, watch } from 'vue'
import type { Ref } from 'vue'
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
   * Whether a list that changed underneath *no* cursor should take one. True exactly when the
   * change is the user's own typing narrowing the list, so `Enter` commits the top match; false
   * for options merely arriving, which would otherwise light a row up on their own.
   */
  shouldSeedCursor: () => boolean
}

/**
 * The cursor into a listbox: which option is active, how the keys move it, and keeping it
 * visible and valid as the list changes underneath.
 *
 * This is **decomposition of `BaseSelect`, not a general-purpose composable** — it exists
 * because that component is otherwise a popover, two control branches, two keyboard
 * dispatchers, a search model and an async pipeline in one file. There is a single consumer;
 * do not reuse it elsewhere expecting a stable contract. The same warning as
 * `useSelectOptions`, for the same reason.
 *
 * Extracted on SRP grounds, not DRY — `docs/decisions.md` rejects extracting for reuse at
 * one consumer, and that entry is about a different motive.
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

  // Keyed on the option *values*, not the array: the source is rebuilt by a `props(field)`
  // factory on every parent render, and resetting the highlight on that would fight the user.
  //
  // `flush: 'post'` for an ordering that is otherwise invisible: a typed term narrows the list
  // in the same tick that opens the panel, and this watcher is created before the one that
  // opens it — a pre-flush run would see `isOpen` still false and skip the seed that term is
  // owed. Keying on `isOpen` instead would make *opening* re-clamp a cursor a printable key had
  // just placed, which is the same bug from the other side.
  watch(
    () => JSON.stringify(input.options().map((option) => option.value)),
    () => {
      if (!input.isOpen.value) return
      // A changed list re-clamps a cursor; it does not *create* one. Without this an async
      // select highlights a row the moment its options land, which no one asked it to do.
      if (activeIndex.value < 0 && !input.shouldSeedCursor()) return

      activeIndex.value = input.options().length === 0 ? -1 : nextEnabledIndex(0, 1)
    },
    { flush: 'post' },
  )

  onBeforeUnmount(() => clearTimeout(typeTimer))

  return {
    activeIndex: readonly(activeIndex) as Readonly<Ref<number>>,
    PAGE_STEP,
    nextEnabledIndex,
    setActive,
    scrollIntoView,
    moveBy,
    moveToFirst,
    moveToLast,
    typeAhead,
    reset,
  }
}
