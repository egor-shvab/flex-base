import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import {
  OPTIONS,
  activeLabel,
  chevron,
  input,
  keydown,
  lastModel,
  listbox,
  open,
  options,
  panel,
  select,
  trigger,
} from '~/components/common/BaseSelect/select-harness'
import { unmountAll } from '~~/test/mount'

/**
 * Choosing a value and showing it back: what a click commits, where the cursor lands on
 * opening, what the control displays for none, one and several, and the clear button.
 */
describe('BaseSelect', () => {
  afterEach(unmountAll)

  afterEach(() => {
    document.body.innerHTML = ''
    vi.useRealTimers()
  })

  describe('choosing', () => {
    it('commits and closes in single mode', async () => {
      const wrapper = await select()
      await open(wrapper)

      await options()[1]!.click()
      await nextTick()

      expect(lastModel(wrapper)).toBe('b')
      expect(panel()).toBeNull()
    })

    /** Picking several values one at a time is the whole point, so the panel stays open. */
    it('toggles and stays open in multi mode', async () => {
      const wrapper = await select({ modelValue: ['a'], multiple: true })
      await open(wrapper)

      options()[1]!.click()
      await nextTick()
      expect(lastModel(wrapper)).toEqual(['a', 'b'])
      expect(panel()).not.toBeNull()

      await wrapper.setProps({ modelValue: ['a', 'b'] })
      options()[0]!.click()
      await nextTick()
      expect(lastModel(wrapper)).toEqual(['b'])
    })

    it('will not choose a disabled option', async () => {
      const wrapper = await select({
        options: [OPTIONS[0]!, { value: 'b', label: 'Bravo', disabled: true }],
      })
      await open(wrapper)

      options()[1]!.click()
      await nextTick()

      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
      expect(panel()).not.toBeNull()
    })

    /** The cast is the seam between a generic model and a component that speaks lists. */
    it('empties a single model to a blank string, not an array', async () => {
      const wrapper = await select({ modelValue: 'b', clearable: true })

      await wrapper.get('.base-select__clear').trigger('click')

      expect(lastModel(wrapper)).toBe('')
    })
  })

  describe('opening', () => {
    /**
     * The cursor is a position the keyboard asked for, and opening is not a navigation. A ring
     * drawn before the user has moved reads as a choice already made — and the same applies to
     * the option under the mouse, which is why hovering is asserted here rather than assumed.
     */
    it('highlights nothing, however the panel was opened', async () => {
      const wrapper = await select({ modelValue: 'c' })
      await open(wrapper)

      expect(activeLabel()).toBeUndefined()
    })

    it('still highlights nothing once the pointer is over an option', async () => {
      const wrapper = await select()
      await open(wrapper)

      options()[1]!.dispatchEvent(new Event('pointermove', { bubbles: true }))
      await nextTick()

      expect(activeLabel()).toBeUndefined()
    })

    /** Opening on the current value is what makes ↑/↓ feel like a native select's. */
    it('reveals the cursor on the selected option at the first arrow', async () => {
      const wrapper = await select({ modelValue: 'c' })
      await open(wrapper)

      keydown(listbox()!, 'ArrowDown')
      await nextTick()

      expect(activeLabel()).toBe('Charlie')
    })

    it('reveals it on the first option when nothing is selected', async () => {
      const wrapper = await select()
      await open(wrapper)

      keydown(listbox()!, 'ArrowDown')
      await nextTick()

      expect(activeLabel()).toBe('Alpha')
    })

    /** Nothing selected and ↑ first: `move` starts from the end the direction implies. */
    it('reveals it on the last option when the first arrow is ↑', async () => {
      const wrapper = await select()
      await open(wrapper)

      keydown(listbox()!, 'ArrowUp')
      await nextTick()

      expect(activeLabel()).toBe('Charlie')
    })

    it('moves focus into the list on the button branch', async () => {
      const wrapper = await select()
      await open(wrapper)

      expect(document.activeElement).toBe(listbox())
    })

    it('keeps focus in the field on the searchable branch', async () => {
      const wrapper = await select({ searchable: true })
      await open(wrapper)

      expect(document.activeElement).toBe(input(wrapper).element)
    })

    it('toggles shut on a second click of the button branch', async () => {
      const wrapper = await select()

      await open(wrapper)
      expect(panel()).not.toBeNull()

      await wrapper.get('.base-select__control').trigger('click')
      await nextTick()
      expect(panel()).toBeNull()
    })

    /**
     * Never a toggle on the searchable branch: a click inside a text field places the caret, and
     * closing on it would make it impossible to click into the middle of a term being edited.
     */
    it('never toggles shut on the searchable branch', async () => {
      const wrapper = await select({ searchable: true })

      await open(wrapper)
      await wrapper.get('.base-select__control').trigger('click')
      await nextTick()

      expect(panel()).not.toBeNull()
    })

    /**
     * The arrow is the pointer route the searchable branch would otherwise lack: the field
     * itself never closes, so without this the only way back out is a click elsewhere.
     */
    it('toggles shut on the chevron of the searchable branch', async () => {
      const wrapper = await select({ searchable: true })

      await open(wrapper)
      expect(panel()).not.toBeNull()

      await chevron(wrapper).trigger('click')
      await nextTick()

      expect(panel()).toBeNull()
    })

    it('opens on the chevron of the searchable branch', async () => {
      const wrapper = await select({ searchable: true })

      await chevron(wrapper).trigger('click')
      await nextTick()
      await nextTick()

      expect(panel()).not.toBeNull()
    })

    /**
     * `.stop` on the chevron is what this pins: the click bubbles to the control, whose button
     * branch toggles too — so without it the panel would close and immediately re-open.
     */
    it('toggles shut on the chevron of the button branch', async () => {
      const wrapper = await select()

      await open(wrapper)
      await chevron(wrapper).trigger('click')
      await nextTick()

      expect(panel()).toBeNull()
    })

    it('ignores a chevron click while disabled', async () => {
      const wrapper = await select({ disabled: true })

      await chevron(wrapper).trigger('click')
      await nextTick()

      expect(panel()).toBeNull()
    })

    /**
     * The open-state class the chevron's rotation hangs off. Asserted structurally because
     * Vitest keeps `test.css` false — the transform itself is only visible in the browser.
     */
    it('marks the root open while the panel is', async () => {
      const wrapper = await select()

      expect(wrapper.classes()).not.toContain('base-select--open')

      await open(wrapper)
      expect(wrapper.classes()).toContain('base-select--open')

      await chevron(wrapper).trigger('click')
      await nextTick()

      expect(wrapper.classes()).not.toContain('base-select--open')
    })

    /** Any way text arrives opens the list — keystroke, paste, IME commit, drop. */
    it('opens when a term arrives in the field', async () => {
      const wrapper = await select({ searchable: true })

      await input(wrapper).setValue('br')
      await nextTick()

      expect(panel()).not.toBeNull()
    })
  })

  describe('what the control shows', () => {
    it('shows the placeholder while nothing is chosen', async () => {
      const wrapper = await select({ placeholder: '— Select —' })

      expect(wrapper.get('.base-select__placeholder').text()).toBe('— Select —')
      expect(wrapper.find('.base-select__value').exists()).toBe(false)
    })

    it('shows a single selection as its label', async () => {
      const wrapper = await select({ modelValue: 'b' })

      expect(wrapper.get('.base-select__value').text()).toBe('Bravo')
    })

    /** A 36px control cannot list them, so several read as a count. */
    it('shows several selections as a count', async () => {
      const wrapper = await select({ modelValue: ['a', 'c'], multiple: true })

      expect(wrapper.get('.base-select__value').text()).toBe('2 selected')
    })

    it('shows a coloured choice as a badge', async () => {
      const wrapper = await select({
        modelValue: 'a',
        options: [{ value: 'a', label: 'Alpha', color: 'blue' }],
      })

      expect(wrapper.find('.base-select__value .base-badge').exists()).toBe(true)
    })

    it('yields to the term the moment the user types', async () => {
      const wrapper = await select({ searchable: true, modelValue: 'b' })
      expect(wrapper.find('.base-select__value').exists()).toBe(true)

      await input(wrapper).setValue('al')

      expect(wrapper.find('.base-select__value').exists()).toBe(false)
    })

    /**
     * A value keeps its label when an async search has replaced the visible list with rows that
     * do not include it — the whole reason `seen` accumulates rather than tracking `options`.
     */
    it('remembers a label the option list no longer carries', async () => {
      const wrapper = await select({ modelValue: 'b' })
      expect(wrapper.get('.base-select__value').text()).toBe('Bravo')

      await wrapper.setProps({ options: [] })

      expect(wrapper.get('.base-select__value').text()).toBe('Bravo')
    })

    it('falls back to the raw value for a label it has never seen', async () => {
      const wrapper = await select({ modelValue: 'z', options: [] })

      expect(wrapper.get('.base-select__value').text()).toBe('z')
    })
  })

  describe('the clear button', () => {
    it('appears only when clearable, enabled and non-empty', async () => {
      const empty = await select({ clearable: true })
      expect(empty.find('.base-select__clear').exists()).toBe(false)
      empty.unmount()

      const notClearable = await select({ modelValue: 'b' })
      expect(notClearable.find('.base-select__clear').exists()).toBe(false)
      notClearable.unmount()

      const disabled = await select({ modelValue: 'b', clearable: true, disabled: true })
      expect(disabled.find('.base-select__clear').exists()).toBe(false)
      disabled.unmount()

      const clearable = await select({ modelValue: 'b', clearable: true })
      expect(clearable.find('.base-select__clear').exists()).toBe(true)
    })

    /** The button unmounts with the selection, so focus would otherwise fall to `<body>`. */
    it('returns focus to the trigger it just removed itself from beside', async () => {
      const wrapper = await select({ modelValue: 'b', clearable: true })

      await wrapper.get('.base-select__clear').trigger('click')

      expect(document.activeElement).toBe(trigger(wrapper).element)
    })

    it('names itself after the control it clears', async () => {
      const wrapper = await select({ modelValue: 'b', clearable: true, label: 'Stage' })

      expect(wrapper.get('.base-select__clear').attributes('aria-label')).toBe('Clear Stage')
    })
  })
})
