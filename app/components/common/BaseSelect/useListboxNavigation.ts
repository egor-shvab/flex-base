import { onBeforeUnmount, nextTick, readonly, ref, watch } from 'vue'
import type { Ref } from 'vue'
import { optionValuesKey } from '~/components/common/BaseSelect/option-values-key'
import type { ISelectOption } from '~/types/select'

const PAGE_STEP = 10
const TYPE_AHEAD_MS = 500

interface IUseListboxNavigationInput {
  options: () => ISelectOption[]
  listRef: Ref<HTMLElement | undefined>
  isOpen: Readonly<Ref<boolean>>
  shouldSeedCursor: () => boolean
}

export function useListboxNavigation(input: IUseListboxNavigationInput) {
  const activeIndex = ref(-1)

  function scrollIntoView(index: number) {
    input.listRef.value?.children[index]?.scrollIntoView({ block: 'nearest' })
  }

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

  // Keyed on the values, not the array, which a `props(field)` factory rebuilds every render.
  // `flush: 'post'`: a typed term narrows the list in the tick that opens the panel
  watch(
    () => optionValuesKey(input.options()),
    () => {
      if (!input.isOpen.value) return
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
