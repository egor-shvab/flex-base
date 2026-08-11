import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import {
  OPTIONS,
  input,
  keydown,
  listbox,
  liveRegion,
  open,
  options,
  select,
  status,
  trigger,
} from '~~/test/select-harness'
import type { TWrapper } from '~~/test/select-harness'
import { unmountAll } from '~~/test/mount'

/**
 * What the component *is* before anything is done to it: which of its two controls renders,
 * how `multiple` is normalised, and the ARIA it exposes. The rig is `~~/test/select-harness`,
 * shared with the three sibling files this was split out of.
 */
describe('BaseSelect', () => {
  afterEach(unmountAll)

  afterEach(() => {
    document.body.innerHTML = ''
    vi.useRealTimers()
  })

  describe('which control it renders', () => {
    it('is a button with native semantics when not searchable', async () => {
      const wrapper = await select()
      const control = trigger(wrapper)

      expect(control.element.tagName).toBe('BUTTON')
      expect(control.attributes('type')).toBe('button')
      expect(control.attributes('aria-haspopup')).toBe('listbox')
    })

    it('is a combobox input when searchable', async () => {
      const wrapper = await select({ searchable: true })
      const control = input(wrapper)

      expect(control.element.tagName).toBe('INPUT')
      expect(control.attributes('role')).toBe('combobox')
      expect(control.attributes('aria-autocomplete')).toBe('list')
    })

    /**
     * On an `<input>`, a self-referencing `aria-labelledby` reads the element's **value**, so the
     * control's accessible name would change with every keystroke. The button branch can use it;
     * this one must not.
     */
    it('does not point the searchable branch at its own value for its name', async () => {
      const wrapper = await select({ searchable: true, label: 'Stage' })

      expect(input(wrapper).attributes('aria-labelledby')).toBeUndefined()
    })

    it('names the button branch with its label and its value', async () => {
      const wrapper = await select({ label: 'Stage' })

      expect(trigger(wrapper).attributes('aria-labelledby')).toBe('stage-label stage-value')
    })

    it('falls back to ariaLabel when there is no visible label', async () => {
      const wrapper = await select({ ariaLabel: 'Stage' })

      expect(trigger(wrapper).attributes('aria-label')).toBe('Stage')
      expect(trigger(wrapper).attributes('aria-labelledby')).toBeUndefined()
    })
  })

  /**
   * The load-bearing normalisation. Vue casts a bare attribute to `true` only for a prop it
   * knows is `Boolean`, and this one's type is conditional on `TModel`, which gives the SFC
   * compiler no constructor to emit — so `<BaseSelect multiple />` arrives as `''`. `vue-tsc`
   * does not catch it: the template checker reads a bare attribute as `true`, so the types agree
   * and the runtime does not. This test is the only thing standing between the two spellings.
   */

  describe('multiple normalisation', () => {
    async function isMultiple(wrapper: TWrapper) {
      await open(wrapper)

      return listbox()?.getAttribute('aria-multiselectable') === 'true'
    }

    it('is single by default', async () => {
      const wrapper = await select()

      expect(await isMultiple(wrapper)).toBe(false)
    })

    it('is single for an explicit false', async () => {
      const wrapper = await select({ multiple: false })

      expect(await isMultiple(wrapper)).toBe(false)
    })

    it('is multi for an explicit true', async () => {
      const wrapper = await select({ modelValue: [], multiple: true })

      expect(await isMultiple(wrapper)).toBe(true)
    })

    it('is multi for the empty string a bare attribute arrives as', async () => {
      const wrapper = await select({ modelValue: [], multiple: '' })

      expect(await isMultiple(wrapper)).toBe(true)
    })
  })

  describe('ARIA', () => {
    it('tracks expansion and only claims a listbox while it has one', async () => {
      const wrapper = await select()

      expect(trigger(wrapper).attributes('aria-expanded')).toBe('false')
      expect(trigger(wrapper).attributes('aria-controls')).toBeUndefined()

      await open(wrapper)

      expect(trigger(wrapper).attributes('aria-expanded')).toBe('true')
      expect(trigger(wrapper).attributes('aria-controls')).toBe(listbox()?.id)
    })

    it('points the active descendant at the highlighted option', async () => {
      const wrapper = await select()
      await open(wrapper)

      keydown(listbox()!, 'ArrowDown')
      await nextTick()

      expect(listbox()?.getAttribute('aria-activedescendant')).toBe(options()[1]?.id)
    })

    it('marks the selected option and disables the unselectable ones', async () => {
      const wrapper = await select({
        modelValue: 'b',
        options: [...OPTIONS, { value: 'd', label: 'Delta', disabled: true }],
      })
      await open(wrapper)

      expect(options().map((option) => option.getAttribute('aria-selected'))).toEqual([
        'false',
        'true',
        'false',
        'false',
      ])
      expect(options()[3]?.getAttribute('aria-disabled')).toBe('true')
      expect(options()[0]?.getAttribute('aria-disabled')).toBeNull()
    })

    it('wires an error to the control', async () => {
      const wrapper = await select({ error: 'Choose a stage' })

      expect(trigger(wrapper).attributes('aria-invalid')).toBe('true')
      expect(trigger(wrapper).attributes('aria-describedby')).toBe('stage-error')
      expect(wrapper.get('.base-select__error').text()).toBe('Choose a stage')
    })

    /**
     * A `<button>` carries its selection in its accessible name; an `<input>`'s value is the
     * search term, so on that branch the selection would otherwise reach assistive tech nowhere
     * outside the option rows.
     */
    it('describes the searchable branch by the value overlay', async () => {
      const wrapper = await select({ searchable: true, modelValue: 'a' })

      expect(input(wrapper).attributes('aria-describedby')).toBe('stage-value')
    })
  })

  /**
   * The announcement cannot live on the visible row: that row is inside `<Teleport v-if="open">`,
   * and a live region inserted in the same frame as its content is not reliably read — so the
   * *first* message of every open would be silent. The region is in the control instead, mounted
   * for the component's whole life.
   */
  describe('the status announcement', () => {
    const emptyField = () => select({ options: [], emptyLabel: 'No choices defined' })

    it('exists before anything is opened, and says nothing', async () => {
      await emptyField()

      expect(liveRegion()).not.toBeNull()
      expect(liveRegion()?.textContent).toBe('')
    })

    it('carries the panel’s message while it is open', async () => {
      const wrapper = await emptyField()
      await open(wrapper)

      expect(liveRegion()?.textContent).toBe('No choices defined')
    })

    /** Empty again on close, or reopening would change nothing and announce nothing. */
    it('empties on close', async () => {
      const wrapper = await emptyField()
      await open(wrapper)

      await wrapper.get('.base-select__control').trigger('click')

      expect(liveRegion()?.textContent).toBe('')
    })

    it('is the only live region — the visible row announces nothing of its own', async () => {
      const wrapper = await emptyField()
      await open(wrapper)

      expect(status()?.textContent?.trim()).toBe('No choices defined')
      expect(status()?.getAttribute('role')).toBeNull()
      expect(document.querySelectorAll('[role="status"]')).toHaveLength(1)
    })
  })
})
