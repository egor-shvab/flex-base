import { afterEach, describe, expect, it } from 'vitest'

import { h } from 'vue'
import BaseListRow from '~/components/ui/BaseListRow.vue'
import { mountTracked, unmountAll } from '~~/test/mount'

describe('BaseListRow', () => {
  afterEach(unmountAll)

  it('renders the title, badge and an icon tile', async () => {
    const wrapper = await mountTracked(BaseListRow, {
      props: { title: 'Company name', badge: 'required', icon: 'material-symbols:abc' },
    })

    expect(wrapper.element.tagName).toBe('LI')
    expect(wrapper.find('.base-list-row__title').text()).toBe('Company name')
    expect(wrapper.find('.base-list-row__name').text()).toContain('required')
    expect(wrapper.find('.base-list-row__icon').exists()).toBe(true)
    expect(wrapper.find('.base-list-row__icon--initials').exists()).toBe(false)
  })

  it('shows initials instead of an icon when both are given', async () => {
    const wrapper = await mountTracked(BaseListRow, {
      props: { title: 'Demo User', initials: 'DU', icon: 'material-symbols:abc' },
    })

    expect(wrapper.find('.base-list-row__icon--initials').text()).toBe('DU')
    expect(wrapper.findAll('.base-list-row__icon')).toHaveLength(1)
  })

  it('separates meta parts with hidden dots and renders each tone', async () => {
    const wrapper = await mountTracked(BaseListRow, {
      props: {
        title: 'Industry',
        meta: [{ text: 'Select', tone: 'strong' }, '8 choices', { text: 'industry', tone: 'code' }],
      },
    })

    const separators = wrapper.findAll('.base-list-row__sep')
    expect(separators).toHaveLength(2)
    expect(separators.every((separator) => separator.attributes('aria-hidden') === 'true')).toBe(
      true,
    )
    expect(wrapper.find('.base-list-row__meta-strong').text()).toBe('Select')
    expect(wrapper.find('code.base-list-row__meta-code').text()).toBe('industry')
  })

  it('omits the meta line when there is nothing to say', async () => {
    const wrapper = await mountTracked(BaseListRow, { props: { title: 'Viewer', meta: [] } })

    expect(wrapper.find('.base-list-row__meta').exists()).toBe(false)
  })

  it('renders the trailing slot beside the body', async () => {
    const wrapper = await mountTracked(BaseListRow, {
      props: { title: 'Admin' },
      slots: { trailing: () => h('button', 'Edit') },
    })

    expect(wrapper.find('.base-list-row__trailing button').text()).toBe('Edit')
    expect(wrapper.find('a').exists()).toBe(false)
  })

  it('makes the whole row a link with a chevron when given a destination', async () => {
    const wrapper = await mountTracked(BaseListRow, {
      props: { title: 'Clients', to: '/w/abc/tables/1' },
    })

    const link = wrapper.find('a')
    expect(link.attributes('href')).toBe('/w/abc/tables/1')
    expect(link.find('.base-list-row__chevron').exists()).toBe(true)
  })
})
