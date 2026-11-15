import { afterEach, describe, expect, it } from 'vitest'

import { h } from 'vue'
import BaseCard from '~/components/ui/BaseCard.vue'
import { mountTracked, unmountAll } from '~~/test/mount'

describe('BaseCard', () => {
  afterEach(unmountAll)

  it('renders a div with only the body when no header or footer is given', async () => {
    const wrapper = await mountTracked(BaseCard, { slots: { default: () => h('p', 'Body') } })

    expect(wrapper.element.tagName).toBe('DIV')
    expect(wrapper.find('p').text()).toBe('Body')
    expect(wrapper.find('.base-card__header').exists()).toBe(false)
    expect(wrapper.find('.base-card__footer').exists()).toBe(false)
  })

  it('wraps the header and footer slots around the body', async () => {
    const wrapper = await mountTracked(BaseCard, {
      slots: {
        header: () => h('h2', 'Title'),
        default: () => h('p', 'Body'),
        footer: () => h('button', 'Act'),
      },
    })

    const children = wrapper.findAll(':scope > *').map((child) => child.element.tagName)
    expect(children).toEqual(['DIV', 'P', 'DIV'])
    expect(wrapper.find('.base-card__header h2').text()).toBe('Title')
    expect(wrapper.find('.base-card__footer button').text()).toBe('Act')
  })

  it('marks its tone, default unless asked', async () => {
    const plain = await mountTracked(BaseCard)
    const danger = await mountTracked(BaseCard, { props: { tone: 'danger' } })

    expect(plain.classes()).toContain('base-card--default')
    expect(danger.classes()).toContain('base-card--danger')
  })

  it('renders the requested element and keeps the caller attributes on it', async () => {
    const wrapper = await mountTracked(BaseCard, {
      props: { tag: 'section' },
      attrs: { 'aria-labelledby': 'panel-title', class: 'table-panel' },
    })

    expect(wrapper.element.tagName).toBe('SECTION')
    expect(wrapper.attributes('aria-labelledby')).toBe('panel-title')
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['base-card', 'table-panel']))
  })
})
