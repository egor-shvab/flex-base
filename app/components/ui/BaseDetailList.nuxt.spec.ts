import { afterEach, describe, expect, it } from 'vitest'

import BaseDetailList from '~/components/ui/BaseDetailList.vue'
import { mountTracked, unmountAll } from '~~/test/mount'

describe('BaseDetailList', () => {
  afterEach(unmountAll)

  it('is a description list, inset for a card unless flush', async () => {
    const inset = await mountTracked(BaseDetailList)
    const flush = await mountTracked(BaseDetailList, { props: { flush: true } })

    expect(inset.element.tagName).toBe('DL')
    expect(inset.classes()).not.toContain('base-detail-list--flush')
    expect(flush.classes()).toContain('base-detail-list--flush')
  })
})
