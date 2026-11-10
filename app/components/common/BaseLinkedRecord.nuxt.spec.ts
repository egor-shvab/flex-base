import { afterEach, describe, expect, it } from 'vitest'
import BaseLinkedRecord from '~/components/common/BaseLinkedRecord.vue'
import { mountTracked, unmountAll } from '~~/test/mount'

const ref = (props: { number: number; label?: string | null }) =>
  mountTracked(BaseLinkedRecord, { props })

describe('BaseLinkedRecord', () => {
  afterEach(unmountAll)

  it('states the number before the label', async () => {
    expect((await ref({ number: 3, label: 'Example' })).text()).toBe('#3 Example')
  })

  /** On raw `textContent`: `text()` normalises exactly the whitespace this is about. */
  it('separates the number from the label with one real space', async () => {
    const wrapper = await ref({ number: 3, label: 'Example' })

    expect(wrapper.element.textContent).toBe('#3 Example')
  })

  it('states the number alone when nothing names the record', async () => {
    expect((await ref({ number: 3, label: null })).text()).toBe('#3')
    expect((await ref({ number: 3 })).text()).toBe('#3')
  })

  it('gives the number an element of its own, and the label none', async () => {
    const wrapper = await ref({ number: 3, label: 'Example' })

    expect(wrapper.get('.linked-record__number').text()).toBe('#3')
    expect(wrapper.element.children).toHaveLength(1)
    expect(wrapper.element.lastChild?.nodeType).toBe(Node.TEXT_NODE)
    expect(wrapper.element.lastChild?.textContent).toBe(' Example')
  })

  it('wraps the pair in a plain inline span that clips nothing itself', async () => {
    const wrapper = await ref({ number: 3, label: 'Example' })

    expect(wrapper.element.tagName).toBe('SPAN')
    expect(wrapper.element.className).toBe('linked-record')
  })
})
