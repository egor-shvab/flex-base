import { afterEach, describe, expect, it } from 'vitest'

import { h } from 'vue'
import BaseFieldMessage from '~/components/ui/BaseFieldMessage.vue'
import { mountTracked, unmountAll } from '~~/test/mount'

describe('BaseFieldMessage', () => {
  afterEach(unmountAll)

  it('renders nothing without a hint or an error', async () => {
    const wrapper = await mountTracked(BaseFieldMessage, { props: { id: 'name' } })

    expect(wrapper.find('.base-field-message').exists()).toBe(false)
  })

  it('shows the error over the hint, identified for its control', async () => {
    const wrapper = await mountTracked(BaseFieldMessage, {
      props: { id: 'name', hint: 'Short', error: 'Required' },
    })

    expect(wrapper.text()).toBe('Required')
    expect(wrapper.attributes('id')).toBe('name-error')
    expect(wrapper.classes()).toContain('base-field-message--error')
  })

  it('stands alone without an id, with its action after the text', async () => {
    const wrapper = await mountTracked(BaseFieldMessage, {
      props: { error: 'Couldn’t load.' },
      slots: { action: () => h('button', 'Try again') },
    })

    expect(wrapper.attributes('id')).toBeUndefined()
    expect(wrapper.text()).toBe('Couldn’t load. Try again')
    expect(wrapper.find('button').exists()).toBe(true)
  })
})
