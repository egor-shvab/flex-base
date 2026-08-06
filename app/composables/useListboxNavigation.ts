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
  active: Readonly<Ref<boolean>>
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

  function scrollActiveIntoView() {
    input.listRef.value?.children[activeIndex.value]?.scrollIntoView({ block: 'nearest' })
  }

  /** The first option at or beyond `from` that can actually be chosen, walking in `step`. */
  function nextEnabled(from: number, step: number): number {
    const options = input.options()

    for (let index = from; index >= 0 && index < options.length; index += step) {
      if (!options[index]?.disabled) return index
    }

    return -1
  }

  function setActive(index: number) {
    if (index < 0) return

    activeIndex.value = index
    void nextTick(scrollActiveIntoView)
  }

  /** No wrap: a listbox that loops has no felt end, and Home/End are the way to the extremes. */
  function move(delta: number) {
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
    const found = nextEnabled(from, step)
    setActive(found >= 0 ? found : nextEnabled(from, -step))
  }

  function first() {
    setActive(nextEnabled(0, 1))
  }

  function last() {
    setActive(nextEnabled(input.options().length - 1, -1))
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
  // factory on every parent render, and resetting the highlight on that would fight the user
  watch(
    () => JSON.stringify(input.options().map((option) => option.value)),
    () => {
      if (!input.active.value) return
      activeIndex.value = input.options().length === 0 ? -1 : nextEnabled(0, 1)
    },
  )

  onBeforeUnmount(() => clearTimeout(typeTimer))

  return {
    activeIndex: readonly(activeIndex) as Readonly<Ref<number>>,
    PAGE_STEP,
    nextEnabled,
    setActive,
    move,
    first,
    last,
    typeAhead,
    reset,
  }
}
