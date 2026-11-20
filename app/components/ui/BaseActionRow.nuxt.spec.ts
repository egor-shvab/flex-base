import { afterEach, describe, expect, it } from 'vitest'

import { h } from 'vue'
import BaseActionRow from '~/components/ui/BaseActionRow.vue'
import { mountTracked, unmountAll } from '~~/test/mount'

describe('BaseActionRow', () => {
  afterEach(unmountAll)

  it('renders a third-level title, the description and the action', async () => {
    const wrapper = await mountTracked(BaseActionRow, {
      props: { title: 'Delete workspace', tone: 'danger' },
      slots: {
        default: () => 'This cannot be undone.',
        action: () => h('button', 'Delete workspace'),
      },
    })

    expect(wrapper.find('h3').text()).toBe('Delete workspace')
    expect(wrapper.find('.base-action-row__description').text()).toBe('This cannot be undone.')
    expect(wrapper.find('.base-action-row__action button').exists()).toBe(true)
    expect(wrapper.classes()).toContain('base-action-row--danger')
  })

  it('renders the requested heading level and no action wrapper without one', async () => {
    const wrapper = await mountTracked(BaseActionRow, { props: { title: 'Export', level: 4 } })

    expect(wrapper.find('h4').text()).toBe('Export')
    expect(wrapper.find('.base-action-row__action').exists()).toBe(false)
  })
})
