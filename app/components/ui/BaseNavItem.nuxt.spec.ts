import { afterEach, describe, expect, it } from 'vitest'

import BaseNavItem from '~/components/ui/BaseNavItem.vue'
import { mountTracked, unmountAll } from '~~/test/mount'

describe('BaseNavItem', () => {
  afterEach(unmountAll)

  it('is a link with its icon, label and trailing count', async () => {
    const wrapper = await mountTracked(BaseNavItem, {
      props: { to: '/tables/1', icon: 'material-symbols:table-outline-rounded' },
      slots: { default: () => 'Clients', trailing: () => '24' },
    })

    expect(wrapper.element.tagName).toBe('A')
    expect(wrapper.attributes('href')).toBe('/tables/1')
    expect(wrapper.find('.base-nav-item__label').text()).toBe('Clients')
    expect(wrapper.find('.base-nav-item__trailing').text()).toBe('24')
  })

  it('is a button without a destination, in the requested tone', async () => {
    const wrapper = await mountTracked(BaseNavItem, {
      props: { tone: 'accent' },
      slots: { default: () => 'Add a table' },
    })

    expect(wrapper.element.tagName).toBe('BUTTON')
    expect(wrapper.attributes('type')).toBe('button')
    expect(wrapper.classes()).toContain('base-nav-item--accent')
    expect(wrapper.find('.base-nav-item__trailing').exists()).toBe(false)
  })

  it('marks a forced active state', async () => {
    const wrapper = await mountTracked(BaseNavItem, {
      props: { to: '/tables/1', active: true },
      slots: { default: () => 'Clients' },
    })

    expect(wrapper.classes()).toContain('base-nav-item--active')
  })
})
