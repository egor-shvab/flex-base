import { afterEach, describe, expect, it } from 'vitest'

import { h } from 'vue'
import BaseCenteredPanel from '~/components/ui/BaseCenteredPanel.vue'
import { mountTracked, unmountAll } from '~~/test/mount'

describe('BaseCenteredPanel', () => {
  afterEach(unmountAll)

  it('puts the body in a card of the requested element, the mark above it', async () => {
    const wrapper = await mountTracked(BaseCenteredPanel, {
      props: { tag: 'main', size: 'lg' },
      slots: { mark: () => h('span', 'Logo'), default: () => h('p', 'Body') },
    })

    expect(wrapper.classes()).toContain('base-centered-panel--lg')
    expect(wrapper.find('.base-centered-panel__mark').text()).toBe('Logo')
    expect(wrapper.find('main.base-centered-panel__card p').text()).toBe('Body')
  })

  it('renders a plain card of the default size and no mark slot without one', async () => {
    const wrapper = await mountTracked(BaseCenteredPanel, {
      slots: { default: () => h('p', 'Body') },
    })

    expect(wrapper.classes()).toContain('base-centered-panel--md')
    expect(wrapper.find('div.base-centered-panel__card').exists()).toBe(true)
    expect(wrapper.find('.base-centered-panel__mark').exists()).toBe(false)
  })
})
