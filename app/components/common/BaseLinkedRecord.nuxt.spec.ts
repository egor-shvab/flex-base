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

  /**
   * The one failure nothing on screen would show: an accessible name is computed from text
   * content, and two adjacent inline elements contribute no space, so a separator living in
   * markup announces `#3Example` and breaks every `getByRole` name match. Asserted on raw
   * `textContent`, since `text()` normalises exactly the whitespace this is about.
   */
  it('separates the number from the label with one real space', async () => {
    const wrapper = await ref({ number: 3, label: 'Example' })

    expect(wrapper.element.textContent).toBe('#3 Example')
  })

  it('states the number alone when nothing names the record', async () => {
    expect((await ref({ number: 3, label: null })).text()).toBe('#3')
    expect((await ref({ number: 3 })).text()).toBe('#3')
  })

  /** What lets the number be styled apart from the label — the point of the whole component. */
  it('gives the number an element of its own, and the label none', async () => {
    const wrapper = await ref({ number: 3, label: 'Example' })

    expect(wrapper.get('.linked-record__number').text()).toBe('#3')
    expect(wrapper.find('.linked-record__label').exists()).toBe(false)
  })

  /**
   * It renders inside `MultiValueCell`, and an atomic inline box is the one thing
   * `text-overflow: ellipsis` cannot reach into. Structure rather than computed style, since
   * `test.css` is `false` and a spec that read a colour here would be testing nothing.
   */
  it('wraps the pair in a plain inline span that clips nothing itself', async () => {
    const wrapper = await ref({ number: 3, label: 'Example' })

    expect(wrapper.element.tagName).toBe('SPAN')
    expect(wrapper.element.className).toBe('linked-record')
  })
})
