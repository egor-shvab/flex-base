import { afterEach, describe, expect, it } from 'vitest'

import BaseCheckbox from '~/components/common/BaseCheckbox.vue'
import { mountTracked, unmountAll } from '~~/test/mount'

function checkbox(props: Record<string, unknown> = {}) {
  return mountTracked(BaseCheckbox, {
    props: { label: 'Required', modelValue: false, ...props } as never,
  })
}

describe('BaseCheckbox', () => {
  afterEach(unmountAll)

  it('is a native checkbox inside its own label', async () => {
    const wrapper = await checkbox({ modelValue: true })
    const input = wrapper.get('input')

    expect(input.attributes('type')).toBe('checkbox')
    expect((input.element as HTMLInputElement).checked).toBe(true)
    expect(input.element.closest('label')?.textContent).toContain('Required')
  })

  it('draws the check as decoration only', async () => {
    const wrapper = await checkbox()

    expect(wrapper.get('.base-checkbox__check').attributes('aria-hidden')).toBe('true')
  })

  it('writes the new state to the model', async () => {
    const wrapper = await checkbox()

    await wrapper.get('input').setValue(true)

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([true])
  })

  it('disables the input itself', async () => {
    const wrapper = await checkbox({ disabled: true })

    expect(wrapper.get('input').attributes('disabled')).toBeDefined()
    expect(wrapper.attributes('disabled')).toBeUndefined()
  })

  it('stays checked while disabled', async () => {
    const wrapper = await checkbox({ modelValue: true, disabled: true })
    const input = wrapper.get('input').element as HTMLInputElement

    expect(input.checked).toBe(true)
    expect(input.disabled).toBe(true)
  })

  it('shows a hint and points the input at it', async () => {
    const wrapper = await checkbox({ id: 'fast', hint: 'Saving gets a little slower.' })

    expect(wrapper.get('input').attributes('aria-describedby')).toBe('fast-hint')
    expect(wrapper.get('#fast-hint').text()).toBe('Saving gets a little slower.')
  })

  it('replaces the hint with an error', async () => {
    const wrapper = await checkbox({ id: 'fast', hint: 'A hint', error: 'A fault' })

    expect(wrapper.find('#fast-hint').exists()).toBe(false)
    expect(wrapper.get('input').attributes('aria-describedby')).toBe('fast-error')
  })

  it('shows an error and points the input at it', async () => {
    const wrapper = await checkbox({ id: 'agree', error: 'Confirm to continue' })
    const input = wrapper.get('input')

    expect(input.attributes('aria-invalid')).toBe('true')
    expect(input.attributes('aria-describedby')).toBe('agree-error')
    expect(wrapper.get('#agree-error').text()).toBe('Confirm to continue')
  })
})
