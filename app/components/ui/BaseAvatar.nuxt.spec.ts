import { afterEach, describe, expect, it } from 'vitest'

import BaseAvatar from '~/components/ui/BaseAvatar.vue'
import BaseIdentity from '~/components/ui/BaseIdentity.vue'
import { mountTracked, unmountAll } from '~~/test/mount'

describe('BaseAvatar', () => {
  afterEach(unmountAll)

  it('shows initials, hidden from assistive technology, small and square by default', async () => {
    const wrapper = await mountTracked(BaseAvatar, { props: { initials: 'DW' } })

    expect(wrapper.text()).toBe('DW')
    expect(wrapper.attributes('aria-hidden')).toBe('true')
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(['base-avatar--sm', 'base-avatar--square']),
    )
  })

  it('shows an icon in the requested size and shape', async () => {
    const wrapper = await mountTracked(BaseAvatar, {
      props: { icon: 'material-symbols:abc', size: 'md', shape: 'round' },
    })

    expect(wrapper.find('.base-avatar__icon').exists()).toBe(true)
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(['base-avatar--md', 'base-avatar--round']),
    )
  })
})

describe('BaseIdentity', () => {
  afterEach(unmountAll)

  it('stacks the name over its caption, and omits an absent caption', async () => {
    const withCaption = await mountTracked(BaseIdentity, {
      props: { name: 'Demo workspace', caption: 'Owner' },
    })
    const bare = await mountTracked(BaseIdentity, { props: { name: 'Choose a workspace' } })

    expect(withCaption.find('.base-identity__name').text()).toBe('Demo workspace')
    expect(withCaption.find('.base-identity__caption').text()).toBe('Owner')
    expect(bare.find('.base-identity__caption').exists()).toBe(false)
  })
})
