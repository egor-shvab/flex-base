import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import {
  OPTIONS,
  activeLabel,
  input,
  keydown,
  lastModel,
  listbox,
  open,
  panel,
  select,
  trigger,
} from '~/components/common/BaseSelect/select-harness'
import { unmountAll } from '~~/test/mount'

/**
 * Every key this control answers, in all three positions it can be in: on a closed trigger,
 * inside the open list, and in the combobox input. Escape layering is the case that is silent
 * when broken — `BaseModal` owns the document listener, so one press must never close both.
 */
describe('BaseSelect', () => {
  afterEach(unmountAll)

  afterEach(() => {
    document.body.innerHTML = ''
    vi.useRealTimers()
  })

  describe('keyboard on the trigger, while closed', () => {
    it.each(['ArrowDown', 'ArrowUp', 'Enter', ' '])('opens the panel on %s', async (key) => {
      const wrapper = await select()

      const event = keydown(trigger(wrapper).element, key)
      await nextTick()

      expect(panel()).not.toBeNull()
      // Also suppresses the click a `<button>` synthesises from Enter/Space, or the panel would
      // open and toggle straight shut
      expect(event.defaultPrevented).toBe(true)
    })

    /** Nothing of ours is open, so Escape belongs to whatever dialog surrounds this control. */
    it('lets Escape through untouched', async () => {
      const onDocument = vi.fn()
      document.addEventListener('keydown', onDocument)

      const wrapper = await select()
      const event = keydown(trigger(wrapper).element, 'Escape')

      expect(onDocument).toHaveBeenCalledTimes(1)
      expect(event.defaultPrevented).toBe(false)

      document.removeEventListener('keydown', onDocument)
    })

    it.each(['Backspace', 'Delete'])('clears the selection on %s when clearable', async (key) => {
      const wrapper = await select({ modelValue: 'b', clearable: true })

      keydown(trigger(wrapper).element, key)
      await nextTick()

      expect(lastModel(wrapper)).toBe('')
    })

    it('does not clear when the control is not clearable', async () => {
      const wrapper = await select({ modelValue: 'b' })

      keydown(trigger(wrapper).element, 'Backspace')
      await nextTick()

      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    })

    it('opens and jumps on a printable key', async () => {
      const wrapper = await select()

      keydown(trigger(wrapper).element, 'c')
      await nextTick()
      await nextTick()

      expect(panel()).not.toBeNull()
      expect(activeLabel()).toBe('Charlie')
    })

    it('does nothing at all while disabled', async () => {
      const wrapper = await select({ disabled: true })

      keydown(trigger(wrapper).element, 'ArrowDown')
      await wrapper.get('.base-select__control').trigger('click')
      await nextTick()

      expect(panel()).toBeNull()
    })
  })

  describe('keyboard in the list, while open', () => {
    async function openList() {
      const wrapper = await select()
      await open(wrapper)

      return wrapper
    }

    /** The panel was opened by a click here, so the first press is the one that reveals it. */
    it('moves with the arrow keys', async () => {
      await openList()

      keydown(listbox()!, 'ArrowDown')
      await nextTick()
      expect(activeLabel()).toBe('Alpha')

      keydown(listbox()!, 'ArrowDown')
      await nextTick()
      expect(activeLabel()).toBe('Bravo')

      keydown(listbox()!, 'ArrowUp')
      await nextTick()
      expect(activeLabel()).toBe('Alpha')
    })

    it('jumps to the ends with Home and End', async () => {
      await openList()

      keydown(listbox()!, 'End')
      await nextTick()
      expect(activeLabel()).toBe('Charlie')

      keydown(listbox()!, 'Home')
      await nextTick()
      expect(activeLabel()).toBe('Alpha')
    })

    it('pages to the ends of a short list', async () => {
      await openList()

      // Every navigation key reveals the cursor before it moves it, Page included
      keydown(listbox()!, 'PageDown')
      await nextTick()
      expect(activeLabel()).toBe('Alpha')

      keydown(listbox()!, 'PageDown')
      await nextTick()
      expect(activeLabel()).toBe('Charlie')

      keydown(listbox()!, 'PageUp')
      await nextTick()
      expect(activeLabel()).toBe('Alpha')
    })

    it.each(['Enter', ' '])('chooses the active option on %s', async (key) => {
      const wrapper = await openList()

      // Two presses: the first reveals the cursor on the top option, the second walks to Bravo —
      // choosing something other than the first is what proves the key reads the cursor
      keydown(listbox()!, 'ArrowDown')
      await nextTick()
      keydown(listbox()!, 'ArrowDown')
      await nextTick()
      keydown(listbox()!, key)
      await nextTick()

      expect(lastModel(wrapper)).toBe('b')
    })

    /** There is nothing to commit until a key has placed the cursor. */
    it.each(['Enter', ' '])('does nothing on %s while no option is highlighted', async (key) => {
      const wrapper = await openList()

      keydown(listbox()!, key)
      await nextTick()

      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
      expect(panel()).not.toBeNull()
    })

    it('dismisses on Tab, letting focus move on', async () => {
      await openList()

      const event = keydown(listbox()!, 'Tab')
      await nextTick()

      expect(panel()).toBeNull()
      expect(event.defaultPrevented).toBe(false)
    })

    it('dismisses on Alt+ArrowUp', async () => {
      await openList()

      keydown(listbox()!, 'ArrowUp', { altKey: true })
      await nextTick()

      expect(panel()).toBeNull()
    })

    it('type-aheads on a printable key', async () => {
      await openList()

      keydown(listbox()!, 'c')
      await nextTick()

      expect(activeLabel()).toBe('Charlie')
    })

    it('skips a disabled option when moving', async () => {
      const wrapper = await select({
        options: [OPTIONS[0]!, { value: 'b', label: 'Bravo', disabled: true }, OPTIONS[2]!],
      })
      await open(wrapper)

      keydown(listbox()!, 'ArrowDown')
      await nextTick()
      keydown(listbox()!, 'ArrowDown')
      await nextTick()

      expect(activeLabel()).toBe('Charlie')
    })
  })

  /**
   * What may create the cursor, which is the whole rule: a navigation key, and nothing else.
   * Opening does not, the pointer does not, and options merely arriving do not — each of those
   * would draw a ring the user never asked for and would then have to notice was not their doing.
   */
  describe('what creates the cursor', () => {
    it('gives the opening arrow the cursor as well, the way a native select does', async () => {
      const wrapper = await select()

      keydown(trigger(wrapper).element, 'ArrowDown')
      await nextTick()

      expect(activeLabel()).toBe('Alpha')
    })

    it('opens with nothing highlighted when the key is Enter rather than an arrow', async () => {
      const wrapper = await select()

      keydown(trigger(wrapper).element, 'Enter')
      await nextTick()

      expect(panel()).not.toBeNull()
      expect(activeLabel()).toBeUndefined()
    })

    it('lands the cursor on the top match as a term narrows the list', async () => {
      const wrapper = await select({ searchable: true })

      await input(wrapper).setValue('br')
      await nextTick()

      expect(activeLabel()).toBe('Bravo')
    })

    /**
     * The async case, and the reason the re-clamp is guarded rather than the open path alone: a
     * relation picker's options land a moment *after* it opens, and re-clamping to the first
     * enabled option would light a row up with no key pressed and no term typed.
     */
    it('leaves the cursor alone when options merely arrive', async () => {
      const wrapper = await select({ options: [] })
      await open(wrapper)

      await wrapper.setProps({ options: OPTIONS })
      await nextTick()

      expect(activeLabel()).toBeUndefined()
    })
  })

  describe('keyboard on the combobox', () => {
    /**
     * The condition a `.stop` modifier cannot express, written out in JS for that reason:
     * `BaseModal` listens on `document`, and focus stays in this input even while the list is
     * shut — so an unconditional stop would mean a **closed** select ate the surrounding
     * drawer's Escape.
     */
    it('swallows Escape only while the panel is open', async () => {
      const onDocument = vi.fn()
      document.addEventListener('keydown', onDocument)

      const wrapper = await select({ searchable: true })
      await open(wrapper)
      expect(panel()).not.toBeNull()

      keydown(input(wrapper).element, 'Escape')
      await nextTick()

      expect(panel()).toBeNull()
      expect(onDocument).not.toHaveBeenCalled()

      // …and now that it is closed, the very same key belongs to the dialog around it
      keydown(input(wrapper).element, 'Escape')
      expect(onDocument).toHaveBeenCalledTimes(1)

      document.removeEventListener('keydown', onDocument)
    })

    it('opens on ArrowDown and moves once open', async () => {
      const wrapper = await select({ searchable: true })

      keydown(input(wrapper).element, 'ArrowDown')
      await nextTick()
      await nextTick()
      expect(panel()).not.toBeNull()

      keydown(input(wrapper).element, 'ArrowDown')
      await nextTick()
      expect(activeLabel()).toBe('Bravo')
    })

    /** Both `FieldFormModal` and the filter drawer wrap their controls in a form. */
    it('leaves Enter to the surrounding form while closed', async () => {
      const wrapper = await select({ searchable: true })

      const event = keydown(input(wrapper).element, 'Enter')
      await nextTick()

      expect(event.defaultPrevented).toBe(false)
      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    })

    it('chooses on Enter once open', async () => {
      const wrapper = await select({ searchable: true })
      await open(wrapper)

      keydown(input(wrapper).element, 'ArrowDown')
      await nextTick()
      keydown(input(wrapper).element, 'ArrowDown')
      await nextTick()
      const event = keydown(input(wrapper).element, 'Enter')
      await nextTick()

      expect(event.defaultPrevented).toBe(true)
      expect(lastModel(wrapper)).toBe('b')
    })

    describe('Backspace', () => {
      const props = { searchable: true, clearable: true, multiple: true, modelValue: ['a', 'b'] }

      it('pops the last value when the term is empty', async () => {
        const wrapper = await select(props)

        keydown(input(wrapper).element, 'Backspace')
        await nextTick()

        expect(lastModel(wrapper)).toEqual(['a'])
      })

      /** Or backspacing through a search would eat the selection behind it. */
      it('leaves the selection alone while there is a term to erase', async () => {
        const wrapper = await select(props)
        await input(wrapper).setValue('br')

        keydown(input(wrapper).element, 'Backspace')
        await nextTick()

        expect(wrapper.emitted('update:modelValue')).toBeUndefined()
      })

      /** Holding the key to erase a term must stop at the end of the text, not run on. */
      it('ignores an auto-repeat', async () => {
        const wrapper = await select(props)

        keydown(input(wrapper).element, 'Backspace', { repeat: true })
        await nextTick()

        expect(wrapper.emitted('update:modelValue')).toBeUndefined()
      })

      it('does nothing when the control is not clearable', async () => {
        const wrapper = await select({ ...props, clearable: false })

        keydown(input(wrapper).element, 'Backspace')
        await nextTick()

        expect(wrapper.emitted('update:modelValue')).toBeUndefined()
      })
    })
  })
})
