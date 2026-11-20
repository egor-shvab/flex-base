import { afterEach, describe, expect, it } from 'vitest'

import BaseCount from '~/components/ui/BaseCount.vue'
import BaseSkeleton from '~/components/ui/BaseSkeleton.vue'
import { mountTracked, unmountAll } from '~~/test/mount'

describe('BaseSkeleton', () => {
  afterEach(unmountAll)

  it('is a hidden placeholder bar, medium unless asked', async () => {
    const md = await mountTracked(BaseSkeleton)
    const sm = await mountTracked(BaseSkeleton, { props: { size: 'sm' } })

    expect(md.attributes('aria-hidden')).toBe('true')
    expect(md.classes()).toContain('base-skeleton--md')
    expect(sm.classes()).toContain('base-skeleton--sm')
  })
})

describe('BaseCount', () => {
  afterEach(unmountAll)

  it('renders its number', async () => {
    const wrapper = await mountTracked(BaseCount, { slots: { default: () => '3' } })

    expect(wrapper.text()).toBe('3')
  })
})
