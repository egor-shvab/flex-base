import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { nextTick } from 'vue'
import BaseSelect from '~/components/common/BaseSelect.vue'
import type { ISelectOption } from '~/types/select'

const OPTIONS: ISelectOption[] = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Bravo' },
  { value: 'c', label: 'Charlie' },
]

/** The panel teleports to `<body>`, so nothing inside it is reachable through the wrapper. */
const panel = () => document.querySelector<HTMLElement>('.base-select__panel')
const listbox = () => document.querySelector<HTMLElement>('[role="listbox"]')
const options = () => [...document.querySelectorAll<HTMLElement>('[role="option"]')]
const status = () => document.querySelector<HTMLElement>('.base-select__status')

const labels = () => options().map((option) => option.textContent?.trim())
const activeLabel = () =>
  document.querySelector<HTMLElement>('.base-select__option--active')?.textContent?.trim()

/** Returns the event so a spec can read `defaultPrevented`. */
function keydown(element: Element, key: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  element.dispatchEvent(event)

  return event
}

/**
 * Props are widened at this one boundary on purpose. The component is generic over its model,
 * and one case here deliberately passes a shape the declared types forbid — `multiple: ''`, what
 * a bare attribute actually arrives as — which no honest signature can express alongside the
 * typed cases. Everything asserted afterwards is read back off the rendered DOM, which is where
 * the real contract lives.
 */
async function select(props: Record<string, unknown> = {}) {
  return mountSuspended(BaseSelect, {
    attachTo: document.body,
    props: { id: 'stage', modelValue: '', options: OPTIONS, ...props } as never,
  })
}

type TWrapper = Awaited<ReturnType<typeof select>>

/** Clicking the control is what both branches route through. */
async function open(wrapper: TWrapper) {
  await wrapper.get('.base-select__control').trigger('click')
  await nextTick()
  await nextTick()
}

const trigger = (wrapper: TWrapper) => wrapper.get('.base-select__trigger')
const input = (wrapper: TWrapper) => wrapper.get('.base-select__input')
const lastModel = (wrapper: TWrapper) => wrapper.emitted('update:modelValue')?.at(-1)?.[0]

describe('BaseSelect', () => {
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

      wrapper.unmount()
    })

    it('is a combobox input when searchable', async () => {
      const wrapper = await select({ searchable: true })
      const control = input(wrapper)

      expect(control.element.tagName).toBe('INPUT')
      expect(control.attributes('role')).toBe('combobox')
      expect(control.attributes('aria-autocomplete')).toBe('list')

      wrapper.unmount()
    })

    /**
     * On an `<input>`, a self-referencing `aria-labelledby` reads the element's **value**, so the
     * control's accessible name would change with every keystroke. The button branch can use it;
     * this one must not.
     */
    it('does not point the searchable branch at its own value for its name', async () => {
      const wrapper = await select({ searchable: true, label: 'Stage' })

      expect(input(wrapper).attributes('aria-labelledby')).toBeUndefined()

      wrapper.unmount()
    })

    it('names the button branch with its label and its value', async () => {
      const wrapper = await select({ label: 'Stage' })

      expect(trigger(wrapper).attributes('aria-labelledby')).toBe('stage-label stage-value')

      wrapper.unmount()
    })

    it('falls back to ariaLabel when there is no visible label', async () => {
      const wrapper = await select({ ariaLabel: 'Stage' })

      expect(trigger(wrapper).attributes('aria-label')).toBe('Stage')
      expect(trigger(wrapper).attributes('aria-labelledby')).toBeUndefined()

      wrapper.unmount()
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

      wrapper.unmount()
    })

    it('is single for an explicit false', async () => {
      const wrapper = await select({ multiple: false })

      expect(await isMultiple(wrapper)).toBe(false)

      wrapper.unmount()
    })

    it('is multi for an explicit true', async () => {
      const wrapper = await select({ modelValue: [], multiple: true })

      expect(await isMultiple(wrapper)).toBe(true)

      wrapper.unmount()
    })

    it('is multi for the empty string a bare attribute arrives as', async () => {
      const wrapper = await select({ modelValue: [], multiple: '' })

      expect(await isMultiple(wrapper)).toBe(true)

      wrapper.unmount()
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

      wrapper.unmount()
    })

    it('points the active descendant at the highlighted option', async () => {
      const wrapper = await select()
      await open(wrapper)

      keydown(listbox()!, 'ArrowDown')
      await nextTick()

      expect(listbox()?.getAttribute('aria-activedescendant')).toBe(options()[1]?.id)

      wrapper.unmount()
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

      wrapper.unmount()
    })

    it('wires an error to the control', async () => {
      const wrapper = await select({ error: 'Choose a stage' })

      expect(trigger(wrapper).attributes('aria-invalid')).toBe('true')
      expect(trigger(wrapper).attributes('aria-describedby')).toBe('stage-error')
      expect(wrapper.get('.base-select__error').text()).toBe('Choose a stage')

      wrapper.unmount()
    })

    /**
     * A `<button>` carries its selection in its accessible name; an `<input>`'s value is the
     * search term, so on that branch the selection would otherwise reach assistive tech nowhere
     * outside the option rows.
     */
    it('describes the searchable branch by the value overlay', async () => {
      const wrapper = await select({ searchable: true, modelValue: 'a' })

      expect(input(wrapper).attributes('aria-describedby')).toBe('stage-value')

      wrapper.unmount()
    })
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

      wrapper.unmount()
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
      wrapper.unmount()
    })

    it.each(['Backspace', 'Delete'])('clears the selection on %s when clearable', async (key) => {
      const wrapper = await select({ modelValue: 'b', clearable: true })

      keydown(trigger(wrapper).element, key)
      await nextTick()

      expect(lastModel(wrapper)).toBe('')

      wrapper.unmount()
    })

    it('does not clear when the control is not clearable', async () => {
      const wrapper = await select({ modelValue: 'b' })

      keydown(trigger(wrapper).element, 'Backspace')
      await nextTick()

      expect(wrapper.emitted('update:modelValue')).toBeUndefined()

      wrapper.unmount()
    })

    it('opens and jumps on a printable key', async () => {
      const wrapper = await select()

      keydown(trigger(wrapper).element, 'c')
      await nextTick()
      await nextTick()

      expect(panel()).not.toBeNull()
      expect(activeLabel()).toBe('Charlie')

      wrapper.unmount()
    })

    it('does nothing at all while disabled', async () => {
      const wrapper = await select({ disabled: true })

      keydown(trigger(wrapper).element, 'ArrowDown')
      await wrapper.get('.base-select__control').trigger('click')
      await nextTick()

      expect(panel()).toBeNull()

      wrapper.unmount()
    })
  })

  describe('keyboard in the list, while open', () => {
    async function openList() {
      const wrapper = await select()
      await open(wrapper)

      return wrapper
    }

    it('moves with the arrow keys', async () => {
      const wrapper = await openList()

      keydown(listbox()!, 'ArrowDown')
      await nextTick()
      expect(activeLabel()).toBe('Bravo')

      keydown(listbox()!, 'ArrowUp')
      await nextTick()
      expect(activeLabel()).toBe('Alpha')

      wrapper.unmount()
    })

    it('jumps to the ends with Home and End', async () => {
      const wrapper = await openList()

      keydown(listbox()!, 'End')
      await nextTick()
      expect(activeLabel()).toBe('Charlie')

      keydown(listbox()!, 'Home')
      await nextTick()
      expect(activeLabel()).toBe('Alpha')

      wrapper.unmount()
    })

    it('pages to the ends of a short list', async () => {
      const wrapper = await openList()

      keydown(listbox()!, 'PageDown')
      await nextTick()
      expect(activeLabel()).toBe('Charlie')

      keydown(listbox()!, 'PageUp')
      await nextTick()
      expect(activeLabel()).toBe('Alpha')

      wrapper.unmount()
    })

    it.each(['Enter', ' '])('chooses the active option on %s', async (key) => {
      const wrapper = await openList()

      keydown(listbox()!, 'ArrowDown')
      await nextTick()
      keydown(listbox()!, key)
      await nextTick()

      expect(lastModel(wrapper)).toBe('b')

      wrapper.unmount()
    })

    it('dismisses on Tab, letting focus move on', async () => {
      const wrapper = await openList()

      const event = keydown(listbox()!, 'Tab')
      await nextTick()

      expect(panel()).toBeNull()
      expect(event.defaultPrevented).toBe(false)

      wrapper.unmount()
    })

    it('dismisses on Alt+ArrowUp', async () => {
      const wrapper = await openList()

      keydown(listbox()!, 'ArrowUp', { altKey: true })
      await nextTick()

      expect(panel()).toBeNull()

      wrapper.unmount()
    })

    it('type-aheads on a printable key', async () => {
      const wrapper = await openList()

      keydown(listbox()!, 'c')
      await nextTick()

      expect(activeLabel()).toBe('Charlie')

      wrapper.unmount()
    })

    it('skips a disabled option when moving', async () => {
      const wrapper = await select({
        options: [OPTIONS[0]!, { value: 'b', label: 'Bravo', disabled: true }, OPTIONS[2]!],
      })
      await open(wrapper)

      keydown(listbox()!, 'ArrowDown')
      await nextTick()

      expect(activeLabel()).toBe('Charlie')

      wrapper.unmount()
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
      wrapper.unmount()
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

      wrapper.unmount()
    })

    /** Both `FieldFormModal` and the filter drawer wrap their controls in a form. */
    it('leaves Enter to the surrounding form while closed', async () => {
      const wrapper = await select({ searchable: true })

      const event = keydown(input(wrapper).element, 'Enter')
      await nextTick()

      expect(event.defaultPrevented).toBe(false)
      expect(wrapper.emitted('update:modelValue')).toBeUndefined()

      wrapper.unmount()
    })

    it('chooses on Enter once open', async () => {
      const wrapper = await select({ searchable: true })
      await open(wrapper)

      keydown(input(wrapper).element, 'ArrowDown')
      await nextTick()
      const event = keydown(input(wrapper).element, 'Enter')
      await nextTick()

      expect(event.defaultPrevented).toBe(true)
      expect(lastModel(wrapper)).toBe('b')

      wrapper.unmount()
    })

    describe('Backspace', () => {
      const props = { searchable: true, clearable: true, multiple: true, modelValue: ['a', 'b'] }

      it('pops the last value when the term is empty', async () => {
        const wrapper = await select(props)

        keydown(input(wrapper).element, 'Backspace')
        await nextTick()

        expect(lastModel(wrapper)).toEqual(['a'])

        wrapper.unmount()
      })

      /** Or backspacing through a search would eat the selection behind it. */
      it('leaves the selection alone while there is a term to erase', async () => {
        const wrapper = await select(props)
        await input(wrapper).setValue('br')

        keydown(input(wrapper).element, 'Backspace')
        await nextTick()

        expect(wrapper.emitted('update:modelValue')).toBeUndefined()

        wrapper.unmount()
      })

      /** Holding the key to erase a term must stop at the end of the text, not run on. */
      it('ignores an auto-repeat', async () => {
        const wrapper = await select(props)

        keydown(input(wrapper).element, 'Backspace', { repeat: true })
        await nextTick()

        expect(wrapper.emitted('update:modelValue')).toBeUndefined()

        wrapper.unmount()
      })

      it('does nothing when the control is not clearable', async () => {
        const wrapper = await select({ ...props, clearable: false })

        keydown(input(wrapper).element, 'Backspace')
        await nextTick()

        expect(wrapper.emitted('update:modelValue')).toBeUndefined()

        wrapper.unmount()
      })
    })
  })

  describe('choosing', () => {
    it('commits and closes in single mode', async () => {
      const wrapper = await select()
      await open(wrapper)

      await options()[1]!.click()
      await nextTick()

      expect(lastModel(wrapper)).toBe('b')
      expect(panel()).toBeNull()

      wrapper.unmount()
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

      wrapper.unmount()
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

      wrapper.unmount()
    })

    /** The cast is the seam between a generic model and a component that speaks lists. */
    it('empties a single model to a blank string, not an array', async () => {
      const wrapper = await select({ modelValue: 'b', clearable: true })

      await wrapper.get('.base-select__clear').trigger('click')

      expect(lastModel(wrapper)).toBe('')

      wrapper.unmount()
    })
  })

  describe('opening', () => {
    /** Opening on the current value is what makes ↑/↓ feel like a native select's. */
    it('lands the cursor on the selected option, not the top', async () => {
      const wrapper = await select({ modelValue: 'c' })
      await open(wrapper)

      expect(activeLabel()).toBe('Charlie')

      wrapper.unmount()
    })

    it('lands on the first option when nothing is selected', async () => {
      const wrapper = await select()
      await open(wrapper)

      expect(activeLabel()).toBe('Alpha')

      wrapper.unmount()
    })

    it('moves focus into the list on the button branch', async () => {
      const wrapper = await select()
      await open(wrapper)

      expect(document.activeElement).toBe(listbox())

      wrapper.unmount()
    })

    it('keeps focus in the field on the searchable branch', async () => {
      const wrapper = await select({ searchable: true })
      await open(wrapper)

      expect(document.activeElement).toBe(input(wrapper).element)

      wrapper.unmount()
    })

    it('toggles shut on a second click of the button branch', async () => {
      const wrapper = await select()

      await open(wrapper)
      expect(panel()).not.toBeNull()

      await wrapper.get('.base-select__control').trigger('click')
      await nextTick()
      expect(panel()).toBeNull()

      wrapper.unmount()
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

      wrapper.unmount()
    })

    /** Any way text arrives opens the list — keystroke, paste, IME commit, drop. */
    it('opens when a term arrives in the field', async () => {
      const wrapper = await select({ searchable: true })

      await input(wrapper).setValue('br')
      await nextTick()

      expect(panel()).not.toBeNull()

      wrapper.unmount()
    })
  })

  describe('what the control shows', () => {
    it('shows the placeholder while nothing is chosen', async () => {
      const wrapper = await select({ placeholder: '— Select —' })

      expect(wrapper.get('.base-select__placeholder').text()).toBe('— Select —')
      expect(wrapper.find('.base-select__value').exists()).toBe(false)

      wrapper.unmount()
    })

    it('shows a single selection as its label', async () => {
      const wrapper = await select({ modelValue: 'b' })

      expect(wrapper.get('.base-select__value').text()).toBe('Bravo')

      wrapper.unmount()
    })

    /** A 36px control cannot list them, so several read as a count. */
    it('shows several selections as a count', async () => {
      const wrapper = await select({ modelValue: ['a', 'c'], multiple: true })

      expect(wrapper.get('.base-select__value').text()).toBe('2 selected')

      wrapper.unmount()
    })

    it('shows a coloured choice as a badge', async () => {
      const wrapper = await select({
        modelValue: 'a',
        options: [{ value: 'a', label: 'Alpha', color: 'blue' }],
      })

      expect(wrapper.find('.base-select__value .base-badge').exists()).toBe(true)

      wrapper.unmount()
    })

    it('yields to the term the moment the user types', async () => {
      const wrapper = await select({ searchable: true, modelValue: 'b' })
      expect(wrapper.find('.base-select__value').exists()).toBe(true)

      await input(wrapper).setValue('al')

      expect(wrapper.find('.base-select__value').exists()).toBe(false)

      wrapper.unmount()
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

      wrapper.unmount()
    })

    it('falls back to the raw value for a label it has never seen', async () => {
      const wrapper = await select({ modelValue: 'z', options: [] })

      expect(wrapper.get('.base-select__value').text()).toBe('z')

      wrapper.unmount()
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
      clearable.unmount()
    })

    /** The button unmounts with the selection, so focus would otherwise fall to `<body>`. */
    it('returns focus to the trigger it just removed itself from beside', async () => {
      const wrapper = await select({ modelValue: 'b', clearable: true })

      await wrapper.get('.base-select__clear').trigger('click')

      expect(document.activeElement).toBe(trigger(wrapper).element)

      wrapper.unmount()
    })

    it('names itself after the control it clears', async () => {
      const wrapper = await select({ modelValue: 'b', clearable: true, label: 'Stage' })

      expect(wrapper.get('.base-select__clear').attributes('aria-label')).toBe('Clear Stage')

      wrapper.unmount()
    })
  })

  describe('the status row', () => {
    it('states the field offers nothing at all', async () => {
      const wrapper = await select({ options: [], emptyLabel: 'No choices defined' })
      await open(wrapper)

      expect(status()?.textContent?.trim()).toBe('No choices defined')

      wrapper.unmount()
    })

    /** Distinct from the above: a search that found nothing is not a field with no choices. */
    it('states a search that found nothing, quoting the term', async () => {
      const wrapper = await select({ searchable: true })

      await input(wrapper).setValue('zzz')
      await nextTick()

      expect(status()?.textContent?.trim()).toBe('No results for “zzz”')

      wrapper.unmount()
    })

    it('says nothing while there are options to show', async () => {
      const wrapper = await select()
      await open(wrapper)

      expect(status()).toBeNull()

      wrapper.unmount()
    })

    it('states a search in flight', async () => {
      const loadOptions = vi.fn(() => new Promise<ISelectOption[]>(() => {}))
      const wrapper = await select({ searchable: true, loadOptions })

      vi.useFakeTimers()
      await input(wrapper).setValue('br')
      vi.advanceTimersByTime(300)
      await nextTick()
      await nextTick()

      expect(status()?.textContent?.trim()).toBe('Searching…')

      wrapper.unmount()
    })

    it('offers a retry when the search fails', async () => {
      const loadOptions = vi.fn(() => Promise.reject(new Error('offline')))
      const wrapper = await select({ searchable: true, loadOptions })

      vi.useFakeTimers()
      await input(wrapper).setValue('br')
      vi.advanceTimersByTime(300)
      await vi.runAllTimersAsync()
      await nextTick()

      expect(status()?.textContent).toContain('Could not load options.')
      expect(status()?.querySelector('.base-button')).not.toBeNull()

      vi.useRealTimers()
      wrapper.unmount()
    })

    /**
     * Inert without `searchable`, since nothing could ever call it — handing the async machine a
     * loader nothing can reach would leave `status` pinned at `idle` and `retry` unreachable.
     */
    it('never calls loadOptions without searchable', async () => {
      const loadOptions = vi.fn(() => Promise.resolve([]))
      const wrapper = await select({ loadOptions })

      await open(wrapper)

      expect(loadOptions).not.toHaveBeenCalled()
      expect(labels()).toEqual(['Alpha', 'Bravo', 'Charlie'])

      wrapper.unmount()
    })
  })

  describe('closing', () => {
    it('filters locally on the typed term', async () => {
      const wrapper = await select({ searchable: true })

      await input(wrapper).setValue('br')
      await nextTick()

      expect(labels()).toEqual(['Bravo'])

      wrapper.unmount()
    })

    /** Reopening must never inherit the last search, nor an index into a refiltered list. */
    it('resets the search and the cursor', async () => {
      const wrapper = await select({ searchable: true })

      await input(wrapper).setValue('br')
      await nextTick()
      expect(labels()).toEqual(['Bravo'])

      keydown(input(wrapper).element, 'Escape')
      await nextTick()
      expect(panel()).toBeNull()

      await open(wrapper)

      expect(input(wrapper).element).toHaveProperty('value', '')
      expect(labels()).toEqual(['Alpha', 'Bravo', 'Charlie'])

      wrapper.unmount()
    })

    it('closes on a pointerdown outside', async () => {
      const wrapper = await select()
      await open(wrapper)

      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
      await nextTick()

      expect(panel()).toBeNull()

      wrapper.unmount()
    })
  })
})
