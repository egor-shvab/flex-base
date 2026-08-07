import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { nextTick } from 'vue'
import BaseInput from '~/components/common/BaseInput.vue'

function input(props: Record<string, unknown> = {}) {
  return mountSuspended(BaseInput, { props: { id: 'company', modelValue: '', ...props } as never })
}

type TInput = Awaited<ReturnType<typeof input>>

const field = (wrapper: TInput) => wrapper.get('input')
const lastModel = (wrapper: TInput) => wrapper.emitted('update:modelValue')?.at(-1)?.[0]

/** Types without going through `setValue`, so a composition can be staged around it. */
async function type(wrapper: TInput, value: string) {
  const element = field(wrapper).element
  element.value = value
  await field(wrapper).trigger('input')
}

describe('BaseInput', () => {
  afterEach(() => vi.useRealTimers())

  describe('structure', () => {
    it('pairs its label with the input', async () => {
      const wrapper = await input({ label: 'Company' })

      expect(wrapper.get('label').attributes('for')).toBe('company')
      expect(wrapper.get('label').text()).toBe('Company')
      expect(field(wrapper).attributes('id')).toBe('company')
    })

    it('renders no label when it has none', async () => {
      const wrapper = await input()

      expect(wrapper.find('label').exists()).toBe(false)
    })

    /** For an input whose visible label lives on a wrapping group — see `BaseRange`. */
    it('takes an aria-label instead', async () => {
      const wrapper = await input({ ariaLabel: 'From' })

      expect(field(wrapper).attributes('aria-label')).toBe('From')
    })

    it('defaults to a text input and honours the type it is given', async () => {
      expect(field(await input()).attributes('type')).toBe('text')
      expect(field(await input({ type: 'number' })).attributes('type')).toBe('number')
      expect(field(await input({ type: 'date' })).attributes('type')).toBe('date')
    })

    it('forwards placeholder and autocomplete', async () => {
      const wrapper = await input({ placeholder: 'Contains…', autocomplete: 'email' })

      expect(field(wrapper).attributes('placeholder')).toBe('Contains…')
      expect(field(wrapper).attributes('autocomplete')).toBe('email')
    })

    /** Same shape as `BaseButton`'s `icon`, and a prop because the registries bind objects. */
    it('renders a decorative leading icon', async () => {
      const wrapper = await input({ icon: 'mdi:magnify' })

      const icon = wrapper.get('.base-input__icon')
      expect(icon.attributes('aria-hidden')).toBe('true')
      expect(field(wrapper).classes()).toContain('base-input__input--with-icon')
    })
  })

  describe('validity', () => {
    it('shows an error and points the input at it', async () => {
      const wrapper = await input({ error: 'Company is required' })

      expect(wrapper.get('.base-input__error').text()).toBe('Company is required')
      expect(field(wrapper).attributes('aria-invalid')).toBe('true')
      expect(field(wrapper).attributes('aria-describedby')).toBe('company-error')
    })

    /** Invalid styling without an inline message, for when a group owns the error line. */
    it('marks itself invalid without a message when the group owns one', async () => {
      const wrapper = await input({ invalid: true })

      expect(field(wrapper).attributes('aria-invalid')).toBe('true')
      expect(field(wrapper).classes()).toContain('base-input__input--invalid')
      // No message of its own, so nothing to describe it by
      expect(field(wrapper).attributes('aria-describedby')).toBeUndefined()
      expect(wrapper.find('.base-input__error').exists()).toBe(false)
    })

    it('claims nothing when it is valid', async () => {
      const wrapper = await input()

      expect(field(wrapper).attributes('aria-invalid')).toBeUndefined()
      expect(field(wrapper).classes()).not.toContain('base-input__input--invalid')
    })
  })

  describe('writing out', () => {
    it('emits what was typed', async () => {
      const wrapper = await input()

      await type(wrapper, 'Acme')

      expect(lastModel(wrapper)).toBe('Acme')
    })

    it('shows a value the model arrived with', async () => {
      const wrapper = await input({ modelValue: 'Acme' })

      expect(field(wrapper).element.value).toBe('Acme')
    })

    it('takes an outside change', async () => {
      const wrapper = await input({ modelValue: 'Acme' })

      await wrapper.setProps({ modelValue: 'Globex' })

      expect(field(wrapper).element.value).toBe('Globex')
    })

    /**
     * `trim` is the `.trim` modifier as a prop, for callers that bind props rather than
     * `v-model` — the field-type registries all do. It behaves like the native modifier: the
     * trimmed value goes to the model and then echoes back into the field, so the text settles
     * trimmed rather than staying as typed.
     */
    it('trims on the way to the model', async () => {
      const wrapper = await input({ trim: true })

      await type(wrapper, '  Acme  ')

      expect(lastModel(wrapper)).toBe('Acme')
      expect(field(wrapper).element.value).toBe('Acme')
    })

    /** Nothing is emitted when trimming leaves the value the model already holds. */
    it('writes nothing for whitespace either side of the current value', async () => {
      const wrapper = await input({ trim: true, modelValue: 'Acme' })

      await type(wrapper, 'Acme  ')

      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    })

    it('leaves whitespace alone without trim', async () => {
      const wrapper = await input()

      await type(wrapper, '  Acme  ')

      expect(lastModel(wrapper)).toBe('  Acme  ')
    })

    /** For inputs that cost a request — the filter drawer's TEXT and range controls. */
    it('holds a keystroke for its debounce', async () => {
      const wrapper = await input({ debounce: 300 })
      vi.useFakeTimers()

      await type(wrapper, 'Acm')
      expect(wrapper.emitted('update:modelValue')).toBeUndefined()

      vi.advanceTimersByTime(300)
      await nextTick()

      expect(lastModel(wrapper)).toBe('Acm')
    })

    it('writes through immediately with no debounce', async () => {
      const wrapper = await input()

      await type(wrapper, 'A')

      expect(lastModel(wrapper)).toBe('A')
    })
  })

  /**
   * The component binds `:value` + `@input` rather than `v-model`, because `v-model` would cast
   * a `type="number"` input's value and write `1.5` back while the user is still typing `1.50`.
   * That costs `v-model`'s composition guard, which is kept by hand — an IME's intermediate
   * text is not input until the composition is committed.
   */
  describe('the hand-rolled composition guard', () => {
    it('writes nothing while a composition is in flight', async () => {
      const wrapper = await input()

      await field(wrapper).trigger('compositionstart')
      await type(wrapper, 'にほ')

      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    })

    it('commits once the composition ends', async () => {
      const wrapper = await input()

      await field(wrapper).trigger('compositionstart')
      await type(wrapper, 'にほんご')

      field(wrapper).element.value = 'にほんご'
      await field(wrapper).trigger('compositionend')

      expect(lastModel(wrapper)).toBe('にほんご')
    })

    it('resumes writing normally after a composition', async () => {
      const wrapper = await input()

      await field(wrapper).trigger('compositionstart')
      field(wrapper).element.value = 'にほんご'
      await field(wrapper).trigger('compositionend')

      await type(wrapper, 'にほんご!')

      expect(lastModel(wrapper)).toBe('にほんご!')
    })
  })
})
