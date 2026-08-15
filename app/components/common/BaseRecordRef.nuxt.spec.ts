import { afterEach, describe, expect, it } from 'vitest'
import BaseRecordRef from '~/components/common/BaseRecordRef.vue'
import { mountTracked, unmountAll } from '~~/test/mount'

const ref = (props: { number: number; label?: string | null }) =>
  mountTracked(BaseRecordRef, { props })

describe('BaseRecordRef', () => {
  afterEach(unmountAll)

  it('states the number before the label', async () => {
    expect((await ref({ number: 3, label: 'Example' })).text()).toBe('#3 Example')
  })

  /**
   * The one failure nothing on screen would show. An option row's accessible name is computed
   * from its text content, and two adjacent inline elements contribute no space between them —
   * so a separator that lives in markup rather than in the text would announce `#3Example` and
   * quietly break every `getByRole` name match. Asserted on raw `textContent`, because
   * `text()` normalises exactly the whitespace this is about.
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

    expect(wrapper.get('.record-ref__number').text()).toBe('#3')
    expect(wrapper.find('.record-ref__label').exists()).toBe(false)
  })

  /**
   * It renders inside `MultiValueCell`, and an atomic inline box is the one thing
   * `text-overflow: ellipsis` cannot reach into. Structure rather than computed style, since
   * `test.css` is `false` and a spec that read a colour here would be testing nothing.
   */
  it('wraps the pair in a plain inline span that clips nothing itself', async () => {
    const wrapper = await ref({ number: 3, label: 'Example' })

    expect(wrapper.element.tagName).toBe('SPAN')
    expect(wrapper.element.className).toBe('record-ref')
  })
})
