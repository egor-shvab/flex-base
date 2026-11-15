import { afterEach, describe, expect, it } from 'vitest'

import BaseDetailRow from '~/components/ui/BaseDetailRow.vue'
import { mountTracked, unmountAll } from '~~/test/mount'

describe('BaseDetailRow', () => {
  afterEach(unmountAll)

  it('pairs the term and the value as a description', async () => {
    const wrapper = await mountTracked(BaseDetailRow, {
      props: { term: 'Created' },
      slots: { default: () => '14 Nov 2026' },
    })

    expect(wrapper.find('dt').text()).toBe('Created')
    expect(wrapper.find('dd').text()).toBe('14 Nov 2026')
    expect(wrapper.find('label').exists()).toBe(false)
    expect(wrapper.find('dd').classes()).toContain('base-detail-row__value--text')
  })

  it('marks the value with the requested variant', async () => {
    const wrapper = await mountTracked(BaseDetailRow, {
      props: { term: 'Address', variant: 'address' },
    })

    expect(wrapper.find('dd').classes()).toContain('base-detail-row__value--address')
  })

  it('marks a wrapping row and its value, so whole content is never clipped', async () => {
    const wrapper = await mountTracked(BaseDetailRow, {
      props: { term: 'Tags', variant: 'wrap' },
    })

    expect(wrapper.classes()).toContain('base-detail-row--wrap')
    expect(wrapper.find('dd').classes()).toContain('base-detail-row__value--wrap')
  })

  it('labels a control and leaves its cell unclipped', async () => {
    const wrapper = await mountTracked(BaseDetailRow, {
      props: { term: 'Workspace name', labelFor: 'name-input', variant: 'mono' },
    })

    expect(wrapper.find('dt label').attributes('for')).toBe('name-input')
    expect(wrapper.find('dd').classes()).toEqual([
      'base-detail-row__value',
      'base-detail-row__value--control',
    ])
  })
})
