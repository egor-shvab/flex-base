import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import {
  OPTIONS,
  activeLabel,
  input,
  lastModel,
  listbox,
  open,
  options,
  panel,
  select,
  trigger,
} from '~~/test/select-harness'
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
    /** Opening on the current value is what makes ↑/↓ feel like a native select's. */
    it('lands the cursor on the selected option, not the top', async () => {
      const wrapper = await select({ modelValue: 'c' })
      await open(wrapper)

      expect(activeLabel()).toBe('Charlie')
    })

    it('lands on the first option when nothing is selected', async () => {
      const wrapper = await select()
      await open(wrapper)

      expect(activeLabel()).toBe('Alpha')
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
