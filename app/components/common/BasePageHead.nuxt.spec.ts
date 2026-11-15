import { afterEach, describe, expect, it } from 'vitest'

import { h } from 'vue'
import BasePageHead from '~/components/common/BasePageHead.vue'
import { mountTracked, unmountAll } from '~~/test/mount'

describe('BasePageHead', () => {
  afterEach(unmountAll)

  it('renders only the page title when given nothing else', async () => {
    const wrapper = await mountTracked(BasePageHead, { props: { title: 'Invitations' } })

    expect(wrapper.find('h1').text()).toBe('Invitations')
    expect(wrapper.find('nav').exists()).toBe(false)
    expect(wrapper.find('.base-page-head__actions').exists()).toBe(false)
    expect(wrapper.find('.base-page-head__description').exists()).toBe(false)
  })

  it('puts the title id on the heading for the page to label itself by', async () => {
    const wrapper = await mountTracked(BasePageHead, {
      props: { title: 'Invitations', titleId: 'page-title' },
    })

    expect(wrapper.find('h1').attributes('id')).toBe('page-title')
  })

  it('renders the crumbs with their action, the title action and the description', async () => {
    const wrapper = await mountTracked(BasePageHead, {
      props: { title: 'Projects', crumbs: [{ label: 'Home', to: '/' }, { label: 'Projects' }] },
      slots: {
        'crumbs-actions': () => h('a', { href: '/settings' }, 'Settings'),
        actions: () => h('button', 'Add record'),
        default: () => '2 tables',
      },
    })

    expect(wrapper.find('.base-page-head__crumbs nav').exists()).toBe(true)
    expect(wrapper.find('.base-page-head__crumbs a[href="/settings"]').text()).toBe('Settings')
    expect(wrapper.find('.base-page-head__actions button').text()).toBe('Add record')
    expect(wrapper.find('.base-page-head__description').text()).toBe('2 tables')
    expect(wrapper.find('.base-page-head__crumbs--current-only').exists()).toBe(false)
  })

  it('marks a trail with no step back, which would stand empty when it shrinks', async () => {
    const wrapper = await mountTracked(BasePageHead, {
      props: { title: 'Your tables', crumbs: [{ label: 'Home' }] },
    })

    expect(wrapper.find('.base-page-head__crumbs--current-only').exists()).toBe(true)
  })
})
