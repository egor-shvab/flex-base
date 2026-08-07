import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref, shallowRef } from 'vue'
import { useListboxNavigation } from '~/composables/useListboxNavigation'
import type { ISelectOption } from '~/types/select'

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
function setup(initial: ISelectOption[] = OPTIONS, initiallyActive = true) {
  const options = shallowRef(initial)
  const active = ref(initiallyActive)
  const listRef = ref<HTMLElement>()

  let nav!: ReturnType<typeof useListboxNavigation>

  const Host = defineComponent({
    setup() {
      nav = useListboxNavigation({ options: () => options.value, listRef, active })
      return () => h('div')
    },
  })

  // `mount` runs setup synchronously, so `nav` is assigned by the time this returns
  const wrapper = mount(Host)

  return { wrapper, options, active, nav }
}

describe('useListboxNavigation', () => {
  afterEach(() => vi.useRealTimers())

  it('starts with no cursor at all', () => {
    const { nav, wrapper } = setup()

    expect(nav.activeIndex.value).toBe(-1)

    wrapper.unmount()
  })

  describe('move', () => {
    it('starts at the top going down and at the bottom going up', () => {
      const down = setup()
      down.nav.move(1)
      expect(down.nav.activeIndex.value).toBe(0)
      down.wrapper.unmount()

      const up = setup()
      up.nav.move(-1)
      expect(up.nav.activeIndex.value).toBe(OPTIONS.length - 1)
      up.wrapper.unmount()
    })

    it('steps one at a time in both directions', () => {
      const { nav, wrapper } = setup()

      nav.setActive(2)
      nav.move(1)
      expect(nav.activeIndex.value).toBe(3)

      nav.move(-1)
      expect(nav.activeIndex.value).toBe(2)

      wrapper.unmount()
    })

    /** A listbox that loops has no felt end; Home/End are the way to the extremes. */
    it('does not wrap at either end', () => {
      const { nav, wrapper } = setup()

      nav.setActive(OPTIONS.length - 1)
      nav.move(1)
      expect(nav.activeIndex.value).toBe(OPTIONS.length - 1)

      nav.setActive(0)
      nav.move(-1)
      expect(nav.activeIndex.value).toBe(0)

      wrapper.unmount()
    })

    it('does nothing at all with an empty list', () => {
      const { nav, wrapper } = setup([])

      nav.move(1)
      expect(nav.activeIndex.value).toBe(-1)

      wrapper.unmount()
    })
  })

  describe('disabled options', () => {
    it('steps over one on the way down and on the way up', () => {
      const { nav, wrapper } = setup([
        option('a', 'Alpha'),
        option('b', 'Bravo', true),
        option('c', 'Charlie'),
      ])

      nav.setActive(0)
      nav.move(1)
      expect(nav.activeIndex.value).toBe(2)

      nav.move(-1)
      expect(nav.activeIndex.value).toBe(0)

      wrapper.unmount()
    })

    /**
     * The case `nextEnabled(from, -step)` exists for: walking forward into a run of disabled
     * options finds nothing ahead, so the search turns round rather than leaving the cursor
     * on an unselectable row.
     */
    it('turns round when a run of disabled options ends the list', () => {
      const { nav, wrapper } = setup([
        option('a', 'Alpha'),
        option('b', 'Bravo'),
        option('c', 'Charlie', true),
        option('d', 'Delta', true),
      ])

      nav.setActive(1)
      nav.move(1)

      expect(nav.activeIndex.value).toBe(1)

      wrapper.unmount()
    })

    it('turns round at the start of the list too', () => {
      const { nav, wrapper } = setup([
        option('a', 'Alpha', true),
        option('b', 'Bravo', true),
        option('c', 'Charlie'),
        option('d', 'Delta'),
      ])

      nav.setActive(2)
      nav.move(-1)

      expect(nav.activeIndex.value).toBe(2)

      wrapper.unmount()
    })

    it('skips a leading disabled run on a first move down', () => {
      const { nav, wrapper } = setup([
        option('a', 'Alpha', true),
        option('b', 'Bravo', true),
        option('c', 'Charlie'),
      ])

      nav.move(1)

      expect(nav.activeIndex.value).toBe(2)

      wrapper.unmount()
    })

    it('leaves the cursor alone when every option is disabled', () => {
      const { nav, wrapper } = setup([option('a', 'Alpha', true), option('b', 'Bravo', true)])

      nav.move(1)

      expect(nav.activeIndex.value).toBe(-1)

      wrapper.unmount()
    })
  })

  describe('first and last', () => {
    it('land on the extremes', () => {
      const { nav, wrapper } = setup()

      nav.last()
      expect(nav.activeIndex.value).toBe(OPTIONS.length - 1)

      nav.first()
      expect(nav.activeIndex.value).toBe(0)

      wrapper.unmount()
    })

    it('land on the first and last *enabled* option', () => {
      const { nav, wrapper } = setup([
        option('a', 'Alpha', true),
        option('b', 'Bravo'),
        option('c', 'Charlie'),
        option('d', 'Delta', true),
      ])

      nav.first()
      expect(nav.activeIndex.value).toBe(1)

      nav.last()
      expect(nav.activeIndex.value).toBe(2)

      wrapper.unmount()
    })
  })

  describe('page steps', () => {
    it('jump by PAGE_STEP where the list is long enough', () => {
      const long = Array.from({ length: 30 }, (_, index) => option(`v${index}`, `Option ${index}`))
      const { nav, wrapper } = setup(long)

      nav.setActive(0)
      nav.move(nav.PAGE_STEP)
      expect(nav.activeIndex.value).toBe(10)

      nav.move(-nav.PAGE_STEP)
      expect(nav.activeIndex.value).toBe(0)

      wrapper.unmount()
    })

    it('clamp rather than overshooting a short list', () => {
      const { nav, wrapper } = setup()

      nav.setActive(1)
      nav.move(nav.PAGE_STEP)
      expect(nav.activeIndex.value).toBe(OPTIONS.length - 1)

      nav.move(-nav.PAGE_STEP)
      expect(nav.activeIndex.value).toBe(0)

      wrapper.unmount()
    })
  })

  /**
   * A native `<select>` jumps to the first option starting with what you type, and replacing it
   * with a listbox deletes that silently.
   */
  describe('typeAhead', () => {
    it('jumps to the first option starting with the character', () => {
      const { nav, wrapper } = setup()

      nav.typeAhead('d')

      expect(nav.activeIndex.value).toBe(3)

      wrapper.unmount()
    })

    it('is case-insensitive', () => {
      const { nav, wrapper } = setup()

      nav.typeAhead('E')

      expect(nav.activeIndex.value).toBe(4)

      wrapper.unmount()
    })

    it('accumulates within the window, so a second letter narrows rather than restarts', () => {
      const { nav, wrapper } = setup()

      nav.typeAhead('c')
      expect(nav.activeIndex.value).toBe(2)

      // 'ca' matches nothing, so the cursor holds. A buffer that restarted per key would read
      // this as a bare 'a' and jump to Alpha.
      nav.typeAhead('a')
      expect(nav.activeIndex.value).toBe(2)

      wrapper.unmount()
    })

    it('distinguishes options sharing a first letter', () => {
      const { nav, wrapper } = setup([
        option('ba', 'Bravo'),
        option('br', 'Bracket'),
        option('bu', 'Bugle'),
      ])

      nav.typeAhead('b')
      expect(nav.activeIndex.value).toBe(0)

      nav.typeAhead('u')
      expect(nav.activeIndex.value).toBe(2)

      wrapper.unmount()
    })

    it('starts a fresh buffer once the window has passed', () => {
      vi.useFakeTimers()
      const { nav, wrapper } = setup()

      nav.typeAhead('c')
      expect(nav.activeIndex.value).toBe(2)

      vi.advanceTimersByTime(500)

      // A fresh 'd' rather than 'cd', which would match nothing
      nav.typeAhead('d')
      expect(nav.activeIndex.value).toBe(3)

      wrapper.unmount()
    })

    it('will not land on a disabled option', () => {
      const { nav, wrapper } = setup([
        option('d1', 'Delta', true),
        option('d2', 'Delta Two'),
        option('e', 'Echo'),
      ])

      nav.typeAhead('d')

      expect(nav.activeIndex.value).toBe(1)

      wrapper.unmount()
    })

    it('leaves the cursor where it was when nothing matches', () => {
      const { nav, wrapper } = setup()

      nav.setActive(2)
      nav.typeAhead('z')

      expect(nav.activeIndex.value).toBe(2)

      wrapper.unmount()
    })
  })

  /**
   * Keyed on the option *values* rather than the array, because both sources come from a
   * `props(field)` factory that returns a fresh array on every parent render.
   */
  describe('re-clamping as the list changes', () => {
    it('re-seats the cursor on the first enabled option when the list is replaced', async () => {
      const { nav, options, wrapper } = setup()

      nav.setActive(4)
      options.value = [option('x', 'Xray', true), option('y', 'Yankee')]
      await nextTick()

      expect(nav.activeIndex.value).toBe(1)

      wrapper.unmount()
    })

    it('drops the cursor when the list empties', async () => {
      const { nav, options, wrapper } = setup()

      nav.setActive(2)
      options.value = []
      await nextTick()

      expect(nav.activeIndex.value).toBe(-1)

      wrapper.unmount()
    })

    it('does not move for a fresh array of the same values', async () => {
      const { nav, options, wrapper } = setup()

      nav.setActive(4)
      options.value = OPTIONS.map((entry) => ({ ...entry }))
      await nextTick()

      // Resetting the highlight on every parent render would fight the user
      expect(nav.activeIndex.value).toBe(4)

      wrapper.unmount()
    })

    it('leaves a closed listbox alone', async () => {
      const { nav, options, active, wrapper } = setup()

      nav.setActive(4)
      active.value = false
      options.value = [option('x', 'Xray')]
      await nextTick()

      expect(nav.activeIndex.value).toBe(4)

      wrapper.unmount()
    })
  })

  describe('reset', () => {
    it('clears the cursor', () => {
      const { nav, wrapper } = setup()

      nav.setActive(3)
      nav.reset()

      expect(nav.activeIndex.value).toBe(-1)

      wrapper.unmount()
    })

    it('clears the type-ahead buffer, so reopening does not continue the last word', () => {
      const { nav, wrapper } = setup()

      nav.typeAhead('c')
      nav.reset()

      // 'd' fresh, not 'cd' — which would match nothing and leave the cursor at -1
      nav.typeAhead('d')
      expect(nav.activeIndex.value).toBe(3)

      wrapper.unmount()
    })
  })

  it('ignores a negative index from setActive', () => {
    const { nav, wrapper } = setup()

    nav.setActive(2)
    nav.setActive(-1)

    expect(nav.activeIndex.value).toBe(2)

    wrapper.unmount()
  })
})
