import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref, shallowRef } from 'vue'
import { useListboxNavigation } from '~/components/common/BaseSelect/useListboxNavigation'
import type { ISelectOption } from '~/types/select'
import { track, unmountAll } from '~~/test/mount'

/** Six enabled options, so a PAGE_STEP of 10 always overshoots and has to clamp. */
const OPTIONS: ISelectOption[] = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Bravo' },
  { value: 'c', label: 'Charlie' },
  { value: 'd', label: 'Delta' },
  { value: 'e', label: 'Echo' },
  { value: 'f', label: 'Foxtrot' },
]

function option(value: string, label: string, disabled = false): ISelectOption {
  return { value, label, disabled }
}

/**
 * A host component, because `onBeforeUnmount` needs an instance. `listRef` stays `undefined`:
 * `scrollIntoView` is optional-chained, and where the cursor *scrolls to* is not the subject —
 * where it *lands* is.
 *
 * The composable's return is captured out of `setup` rather than read back off `wrapper.vm`,
 * which unwraps refs and would make `activeIndex` a number the declared type says is a `Ref`.
 */
function setup(initial: ISelectOption[] = OPTIONS, initiallyOpen = true) {
  const options = shallowRef(initial)
  const isOpen = ref(initiallyOpen)
  const listRef = ref<HTMLElement>()
  /** What a typed term would say. False here, which is the plain case: no term, no seeding. */
  const shouldSeedCursor = ref(false)

  let nav!: ReturnType<typeof useListboxNavigation>

  const Host = defineComponent({
    setup() {
      nav = useListboxNavigation({
        options: () => options.value,
        listRef,
        isOpen,
        shouldSeedCursor: () => shouldSeedCursor.value,
      })
      return () => h('div')
    },
  })

  // `mount` runs setup synchronously, so `nav` is assigned by the time this returns
  const wrapper = track(mount(Host))

  return { wrapper, options, isOpen, shouldSeedCursor, nav }
}

describe('useListboxNavigation', () => {
  afterEach(unmountAll)

  afterEach(() => vi.useRealTimers())

  it('starts with no cursor at all', () => {
    const { nav } = setup()

    expect(nav.activeIndex.value).toBe(-1)
  })

  describe('move', () => {
    it('starts at the top going down and at the bottom going up', () => {
      const down = setup()
      down.nav.moveBy(1)
      expect(down.nav.activeIndex.value).toBe(0)
      down.wrapper.unmount()

      const up = setup()
      up.nav.moveBy(-1)
      expect(up.nav.activeIndex.value).toBe(OPTIONS.length - 1)
      up.wrapper.unmount()
    })

    it('steps one at a time in both directions', () => {
      const { nav } = setup()

      nav.setActive(2)
      nav.moveBy(1)
      expect(nav.activeIndex.value).toBe(3)

      nav.moveBy(-1)
      expect(nav.activeIndex.value).toBe(2)
    })

    /** A listbox that loops has no felt end; Home/End are the way to the extremes. */
    it('does not wrap at either end', () => {
      const { nav } = setup()

      nav.setActive(OPTIONS.length - 1)
      nav.moveBy(1)
      expect(nav.activeIndex.value).toBe(OPTIONS.length - 1)

      nav.setActive(0)
      nav.moveBy(-1)
      expect(nav.activeIndex.value).toBe(0)
    })

    it('does nothing at all with an empty list', () => {
      const { nav } = setup([])

      nav.moveBy(1)
      expect(nav.activeIndex.value).toBe(-1)
    })
  })

  describe('disabled options', () => {
    it('steps over one on the way down and on the way up', () => {
      const { nav } = setup([
        option('a', 'Alpha'),
        option('b', 'Bravo', true),
        option('c', 'Charlie'),
      ])

      nav.setActive(0)
      nav.moveBy(1)
      expect(nav.activeIndex.value).toBe(2)

      nav.moveBy(-1)
      expect(nav.activeIndex.value).toBe(0)
    })

    /**
     * The case `nextEnabledIndex(from, -step)` exists for: walking forward into a run of disabled
     * options finds nothing ahead, so the search turns round rather than leaving the cursor
     * on an unselectable row.
     */
    it('turns round when a run of disabled options ends the list', () => {
      const { nav } = setup([
        option('a', 'Alpha'),
        option('b', 'Bravo'),
        option('c', 'Charlie', true),
        option('d', 'Delta', true),
      ])

      nav.setActive(1)
      nav.moveBy(1)

      expect(nav.activeIndex.value).toBe(1)
    })

    it('turns round at the start of the list too', () => {
      const { nav } = setup([
        option('a', 'Alpha', true),
        option('b', 'Bravo', true),
        option('c', 'Charlie'),
        option('d', 'Delta'),
      ])

      nav.setActive(2)
      nav.moveBy(-1)

      expect(nav.activeIndex.value).toBe(2)
    })

    it('skips a leading disabled run on a first move down', () => {
      const { nav } = setup([
        option('a', 'Alpha', true),
        option('b', 'Bravo', true),
        option('c', 'Charlie'),
      ])

      nav.moveBy(1)

      expect(nav.activeIndex.value).toBe(2)
    })

    it('leaves the cursor alone when every option is disabled', () => {
      const { nav } = setup([option('a', 'Alpha', true), option('b', 'Bravo', true)])

      nav.moveBy(1)

      expect(nav.activeIndex.value).toBe(-1)
    })
  })

  describe('first and last', () => {
    it('land on the extremes', () => {
      const { nav } = setup()

      nav.moveToLast()
      expect(nav.activeIndex.value).toBe(OPTIONS.length - 1)

      nav.moveToFirst()
      expect(nav.activeIndex.value).toBe(0)
    })

    it('land on the first and last *enabled* option', () => {
      const { nav } = setup([
        option('a', 'Alpha', true),
        option('b', 'Bravo'),
        option('c', 'Charlie'),
        option('d', 'Delta', true),
      ])

      nav.moveToFirst()
      expect(nav.activeIndex.value).toBe(1)

      nav.moveToLast()
      expect(nav.activeIndex.value).toBe(2)
    })
  })

  describe('page steps', () => {
    it('jump by PAGE_STEP where the list is long enough', () => {
      const long = Array.from({ length: 30 }, (_, index) => option(`v${index}`, `Option ${index}`))
      const { nav } = setup(long)

      nav.setActive(0)
      nav.moveBy(nav.PAGE_STEP)
      expect(nav.activeIndex.value).toBe(10)

      nav.moveBy(-nav.PAGE_STEP)
      expect(nav.activeIndex.value).toBe(0)
    })

    it('clamp rather than overshooting a short list', () => {
      const { nav } = setup()

      nav.setActive(1)
      nav.moveBy(nav.PAGE_STEP)
      expect(nav.activeIndex.value).toBe(OPTIONS.length - 1)

      nav.moveBy(-nav.PAGE_STEP)
      expect(nav.activeIndex.value).toBe(0)
    })
  })

  /**
   * A native `<select>` jumps to the first option starting with what you type, and replacing it
   * with a listbox deletes that silently.
   */
  describe('typeAhead', () => {
    it('jumps to the first option starting with the character', () => {
      const { nav } = setup()

      nav.typeAhead('d')

      expect(nav.activeIndex.value).toBe(3)
    })

    it('is case-insensitive', () => {
      const { nav } = setup()

      nav.typeAhead('E')

      expect(nav.activeIndex.value).toBe(4)
    })

    it('accumulates within the window, so a second letter narrows rather than restarts', () => {
      const { nav } = setup()

      nav.typeAhead('c')
      expect(nav.activeIndex.value).toBe(2)

      // 'ca' matches nothing, so the cursor holds. A buffer that restarted per key would read
      // this as a bare 'a' and jump to Alpha.
      nav.typeAhead('a')
      expect(nav.activeIndex.value).toBe(2)
    })

    it('distinguishes options sharing a first letter', () => {
      const { nav } = setup([option('ba', 'Bravo'), option('br', 'Bracket'), option('bu', 'Bugle')])

      nav.typeAhead('b')
      expect(nav.activeIndex.value).toBe(0)

      nav.typeAhead('u')
      expect(nav.activeIndex.value).toBe(2)
    })

    it('starts a fresh buffer once the window has passed', () => {
      vi.useFakeTimers()
      const { nav } = setup()

      nav.typeAhead('c')
      expect(nav.activeIndex.value).toBe(2)

      vi.advanceTimersByTime(500)

      // A fresh 'd' rather than 'cd', which would match nothing
      nav.typeAhead('d')
      expect(nav.activeIndex.value).toBe(3)
    })

    it('will not land on a disabled option', () => {
      const { nav } = setup([
        option('d1', 'Delta', true),
        option('d2', 'Delta Two'),
        option('e', 'Echo'),
      ])

      nav.typeAhead('d')

      expect(nav.activeIndex.value).toBe(1)
    })

    it('leaves the cursor where it was when nothing matches', () => {
      const { nav } = setup()

      nav.setActive(2)
      nav.typeAhead('z')

      expect(nav.activeIndex.value).toBe(2)
    })
  })

  /**
   * Keyed on the option *values* rather than the array, because both sources come from a
   * `props(field)` factory that returns a fresh array on every parent render.
   */
  describe('re-clamping as the list changes', () => {
    it('re-seats the cursor on the first enabled option when the list is replaced', async () => {
      const { nav, options } = setup()

      nav.setActive(4)
      options.value = [option('x', 'Xray', true), option('y', 'Yankee')]
      await nextTick()

      expect(nav.activeIndex.value).toBe(1)
    })

    it('drops the cursor when the list empties', async () => {
      const { nav, options } = setup()

      nav.setActive(2)
      options.value = []
      await nextTick()

      expect(nav.activeIndex.value).toBe(-1)
    })

    it('does not move for a fresh array of the same values', async () => {
      const { nav, options } = setup()

      nav.setActive(4)
      options.value = OPTIONS.map((entry) => ({ ...entry }))
      await nextTick()

      // Resetting the highlight on every parent render would fight the user
      expect(nav.activeIndex.value).toBe(4)
    })

    it('leaves a closed listbox alone', async () => {
      const { nav, options, isOpen } = setup()

      nav.setActive(4)
      isOpen.value = false
      options.value = [option('x', 'Xray')]
      await nextTick()

      expect(nav.activeIndex.value).toBe(4)
    })

    /**
     * The difference between validating a cursor and inventing one. An async select's options
     * land while it is open and no key has been pressed; re-seating to the first enabled option
     * there would light a row up on its own, which is what `shouldSeedCursor` gates.
     */
    it('creates no cursor for a list that changes under none', async () => {
      const { nav, options } = setup()

      options.value = [option('x', 'Xray'), option('y', 'Yankee')]
      await nextTick()

      expect(nav.activeIndex.value).toBe(-1)
    })

    it('creates one when the change is a term narrowing the list', async () => {
      const { nav, options, shouldSeedCursor } = setup()

      shouldSeedCursor.value = true
      options.value = [option('x', 'Xray', true), option('y', 'Yankee')]
      await nextTick()

      // The first *enabled* match, so Enter commits what the term found
      expect(nav.activeIndex.value).toBe(1)
    })
  })

  describe('reset', () => {
    it('clears the cursor', () => {
      const { nav } = setup()

      nav.setActive(3)
      nav.reset()

      expect(nav.activeIndex.value).toBe(-1)
    })

    it('clears the type-ahead buffer, so reopening does not continue the last word', () => {
      const { nav } = setup()

      nav.typeAhead('c')
      nav.reset()

      // 'd' fresh, not 'cd' — which would match nothing and leave the cursor at -1
      nav.typeAhead('d')
      expect(nav.activeIndex.value).toBe(3)
    })
  })

  it('ignores a negative index from setActive', () => {
    const { nav } = setup()

    nav.setActive(2)
    nav.setActive(-1)

    expect(nav.activeIndex.value).toBe(2)
  })
})
