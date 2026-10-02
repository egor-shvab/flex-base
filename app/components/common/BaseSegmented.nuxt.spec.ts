import { afterEach, describe, expect, it } from 'vitest'

import BaseSegmented from '~/components/common/BaseSegmented.vue'
import { mountTracked, unmountAll } from '~~/test/mount'

const OPTIONS = [
  { value: '', label: 'All' },
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
]

function segmented(props: Record<string, unknown> = {}) {
  return mountTracked(BaseSegmented, {
    props: { id: 'active', label: 'Active', options: OPTIONS, modelValue: '', ...props } as never,
    attachTo: document.body,
  })
}

type TSegmented = Awaited<ReturnType<typeof segmented>>

const radios = (wrapper: TSegmented) => wrapper.findAll('[role="radio"]')
const lastModel = (wrapper: TSegmented) => wrapper.emitted('update:modelValue')?.at(-1)?.[0]

describe('BaseSegmented', () => {
  afterEach(unmountAll)

  it('is a radiogroup named by its label', async () => {
    const wrapper = await segmented()
    const group = wrapper.get('[role="radiogroup"]')

    expect(group.attributes('aria-labelledby')).toBe('active-label')
    expect(wrapper.get('#active-label').text()).toBe('Active')
    expect(radios(wrapper).map((radio) => radio.text())).toEqual(['All', 'Yes', 'No'])
  })

  it('marks exactly the chosen segment checked', async () => {
    const wrapper = await segmented({ modelValue: 'true' })

    expect(radios(wrapper).map((radio) => radio.attributes('aria-checked'))).toEqual([
      'false',
      'true',
      'false',
    ])
  })

  it('puts the only tab stop on the chosen segment', async () => {
    const wrapper = await segmented({ modelValue: 'false' })

    expect(radios(wrapper).map((radio) => radio.attributes('tabindex'))).toEqual(['-1', '-1', '0'])
  })

  it('chooses on click, with no Apply', async () => {
    const wrapper = await segmented()

    await radios(wrapper)[1]!.trigger('click')

    expect(lastModel(wrapper)).toBe('true')
  })

  it('emits nothing for the segment already chosen', async () => {
    const wrapper = await segmented({ modelValue: 'true' })

    await radios(wrapper)[1]!.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('moves and chooses with the arrows, wrapping at the ends', async () => {
    const wrapper = await segmented()
    const group = wrapper.get('[role="radiogroup"]')

    await group.trigger('keydown', { key: 'ArrowLeft' })
    expect(lastModel(wrapper)).toBe('false')
    expect(document.activeElement).toBe(radios(wrapper)[2]!.element)

    await wrapper.setProps({ modelValue: 'false' })
    await group.trigger('keydown', { key: 'ArrowRight' })
    expect(lastModel(wrapper)).toBe('')
  })

  it('jumps with Home and End', async () => {
    const wrapper = await segmented({ modelValue: 'true' })
    const group = wrapper.get('[role="radiogroup"]')

    await group.trigger('keydown', { key: 'End' })
    expect(lastModel(wrapper)).toBe('false')

    await group.trigger('keydown', { key: 'Home' })
    expect(lastModel(wrapper)).toBe('')
  })
})
