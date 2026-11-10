import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'

import BaseField from '~/components/common/BaseField.vue'
import { mountTracked, unmountAll } from '~~/test/mount'

const Harness = defineComponent({
  props: {
    label: { type: String, default: undefined },
    labelFor: { type: String, default: undefined },
    error: { type: String, default: undefined },
    hint: { type: String, default: undefined },
  },
  setup(props) {
    return () =>
      h(
        BaseField,
        { id: 'stage', ...props },
        {
          default: ({
            labelId,
            describedBy,
          }: {
            labelId: string | undefined
            describedBy: string | undefined
          }) =>
            h('input', {
              id: 'stage',
              'aria-labelledby': labelId,
              'aria-describedby': describedBy,
            }),
        },
      )
  },
})

function field(props: Record<string, unknown> = {}) {
  return mountTracked(Harness, { props: props as never })
}

describe('BaseField', () => {
  afterEach(unmountAll)

  describe('the label', () => {
    it('is a <label> pointing at the id it is given', async () => {
      const wrapper = await field({ label: 'Stage', labelFor: 'stage' })
      const label = wrapper.get('#stage-label')

      expect(label.element.tagName).toBe('LABEL')
      expect(label.attributes('for')).toBe('stage')
      expect(label.text()).toBe('Stage')
    })

    it('is a <span> the control names itself by when it points nowhere', async () => {
      const wrapper = await field({ label: 'Stage' })

      expect(wrapper.get('#stage-label').element.tagName).toBe('SPAN')
      expect(wrapper.get('input').attributes('aria-labelledby')).toBe('stage-label')
    })

    it('is absent, and names nothing, without a label', async () => {
      const wrapper = await field()

      expect(wrapper.find('#stage-label').exists()).toBe(false)
      expect(wrapper.get('input').attributes('aria-labelledby')).toBeUndefined()
    })
  })

  describe('the message line', () => {
    it('shows a hint and describes the control by it', async () => {
      const wrapper = await field({ hint: 'Where the deal stands' })

      expect(wrapper.get('#stage-hint').text()).toBe('Where the deal stands')
      expect(wrapper.get('input').attributes('aria-describedby')).toBe('stage-hint')
    })

    it('gives the line to an error, and describes the control by that instead', async () => {
      const wrapper = await field({ hint: 'Where the deal stands', error: 'Choose a stage' })

      expect(wrapper.find('#stage-hint').exists()).toBe(false)
      expect(wrapper.get('#stage-error').text()).toBe('Choose a stage')
      expect(wrapper.get('input').attributes('aria-describedby')).toBe('stage-error')
    })

    it('describes nothing when there is no line', async () => {
      const wrapper = await field()

      expect(wrapper.find('.base-field-message').exists()).toBe(false)
      expect(wrapper.get('input').attributes('aria-describedby')).toBeUndefined()
    })
  })
})
