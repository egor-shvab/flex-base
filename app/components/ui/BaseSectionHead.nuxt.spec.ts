import { afterEach, describe, expect, it } from 'vitest'

import { h } from 'vue'
import BaseSectionHead from '~/components/ui/BaseSectionHead.vue'
import { mountTracked, unmountAll } from '~~/test/mount'

describe('BaseSectionHead', () => {
  afterEach(unmountAll)

  it('renders a second-level heading with its id and nothing else by default', async () => {
    const wrapper = await mountTracked(BaseSectionHead, {
      props: { title: 'Members', titleId: 'members-title' },
    })

    const heading = wrapper.find('h2')
    expect(heading.text()).toBe('Members')
    expect(heading.attributes('id')).toBe('members-title')
    expect(wrapper.find('.base-section-head__count').exists()).toBe(false)
    expect(wrapper.find('.base-section-head__actions').exists()).toBe(false)
  })

  it('renders the requested heading level', async () => {
    const wrapper = await mountTracked(BaseSectionHead, {
      props: { title: 'Pending invitations', level: 3 },
    })

    expect(wrapper.find('h3').text()).toBe('Pending invitations')
    expect(wrapper.find('h2').exists()).toBe(false)
  })

  it('shows a count of zero', async () => {
    const wrapper = await mountTracked(BaseSectionHead, { props: { title: 'Roles', count: 0 } })

    expect(wrapper.find('.base-section-head__count').text()).toBe('0')
  })

  it('renders the actions slot', async () => {
    const wrapper = await mountTracked(BaseSectionHead, {
      props: { title: 'Roles' },
      slots: { actions: () => h('button', 'New role') },
    })

    expect(wrapper.find('.base-section-head__actions button').text()).toBe('New role')
  })
})
