import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { useNuxtApp } from '#imports'
import { setActivePinia } from 'pinia'
import type { Pinia } from 'pinia'
import { nextTick } from 'vue'
import { UNKNOWN_RECORD_LABEL } from '#shared/constants/record'
import RelationFieldSelect from '~/field-types/relation/RelationFieldSelect.vue'
import { useRelationsStore } from '~/stores/relations'
import { mountTracked, unmountAll } from '~~/test/mount'

const FIELD_ID = 'fld_owner'

const SEED = [
  { id: 'rec_ada', number: 1, label: 'Ada Lovelace' },
  { id: 'rec_grace', number: 2, label: 'Grace Hopper' },
]

registerEndpoint('/api/tables/tbl_people/fields/fld_owner/options', () => ({
  options: [{ id: 'rec_margaret', number: 3, label: 'Margaret Hamilton' }],
}))

const panel = () => document.querySelector<HTMLElement>('.base-select__panel')
const listbox = () => document.querySelector<HTMLElement>('[role="listbox"]')
const optionLabels = () =>
  [...document.querySelectorAll<HTMLElement>('[role="option"]')].map((option) =>
    option.textContent?.trim(),
  )

function mountControl(props: Record<string, unknown> = {}) {
  return mountTracked(RelationFieldSelect, {
    attachTo: document.body,
    props: { id: 'owner', label: 'Owner', fieldId: FIELD_ID, modelValue: '', ...props } as never,
  })
}

type TWrapper = Awaited<ReturnType<typeof mountControl>>

const lastModel = (wrapper: TWrapper) => wrapper.emitted('update:modelValue')?.at(-1)?.[0]

async function open(wrapper: TWrapper) {
  await wrapper.get('.base-select__control').trigger('click')
  await nextTick()
  await nextTick()
}

describe('RelationFieldSelect', () => {
  afterEach(unmountAll)

  beforeEach(() => {
    setActivePinia(useNuxtApp().$pinia as Pinia)

    const relations = useRelationsStore()
    relations.optionsByField = { [FIELD_ID]: [...SEED] }
    relations.linkedByField = {
      [FIELD_ID]: Object.fromEntries(
        SEED.map((option) => [option.id, { number: option.number, label: option.label }]),
      ),
    }
    relations.tableAddressByField = { [FIELD_ID]: 'tbl_people' }

    document.body.innerHTML = ''
  })

  describe('which branch it renders', () => {
    it('is single by default', async () => {
      const wrapper = await mountControl()
      await open(wrapper)

      expect(listbox()?.getAttribute('aria-multiselectable')).not.toBe('true')
    })

    it('is multi when the field holds several', async () => {
      const wrapper = await mountControl({ multiple: true, modelValue: [] })
      await open(wrapper)

      expect(listbox()?.getAttribute('aria-multiselectable')).toBe('true')
    })

    it('is searchable either way, since the seed is capped rather than complete', async () => {
      const single = await mountControl()
      expect(single.find('.base-select__input').exists()).toBe(true)
      single.unmount()

      const multi = await mountControl({ multiple: true, modelValue: [] })
      expect(multi.find('.base-select__input').exists()).toBe(true)
    })
  })

  describe('the model it hands each branch', () => {
    it('reads a blank single value as nothing selected', async () => {
      const wrapper = await mountControl({ modelValue: '' })
      await open(wrapper)

      expect(document.querySelector('.base-select__value')).toBeNull()
    })

    it('writes a bare string back from the single branch', async () => {
      const wrapper = await mountControl({ modelValue: '' })
      await open(wrapper)

      document.querySelectorAll<HTMLElement>('[role="option"]')[0]?.click()
      await nextTick()

      expect(lastModel(wrapper)).toBe('rec_ada')
    })

    it('writes an array back from the multi branch', async () => {
      const wrapper = await mountControl({ multiple: true, modelValue: ['rec_ada'] })
      await open(wrapper)

      document.querySelectorAll<HTMLElement>('[role="option"]')[1]?.click()
      await nextTick()

      expect(lastModel(wrapper)).toEqual(['rec_ada', 'rec_grace'])
    })

    it('reads the first entry when a single model arrives as a list', async () => {
      const wrapper = await mountControl({ modelValue: ['rec_grace'] })

      expect(wrapper.get('.base-select__value').text()).toBe('#2 Grace Hopper')
    })
  })

  describe('how a record reads', () => {
    it('states the number before the label in every option', async () => {
      const wrapper = await mountControl()
      await open(wrapper)

      expect(optionLabels()).toEqual(['#1 Ada Lovelace', '#2 Grace Hopper'])
    })

    it('gives the number an element of its own inside the option', async () => {
      const wrapper = await mountControl()
      await open(wrapper)

      const first = document.querySelector<HTMLElement>('[role="option"]')

      expect(first?.querySelector('.linked-record__number')?.textContent).toBe('#1')
    })

    it('shows the same flat text in the trigger', async () => {
      const wrapper = await mountControl({ modelValue: 'rec_ada' })

      expect(wrapper.get('.base-select__value').text()).toBe('#1 Ada Lovelace')
    })
  })

  describe('a link the seed list does not offer', () => {
    it('is still offered, read from the cache', async () => {
      const relations = useRelationsStore()
      relations.linkedByField[FIELD_ID]!.rec_katherine = { number: 12, label: 'Katherine Johnson' }

      const wrapper = await mountControl({ modelValue: 'rec_katherine' })
      await open(wrapper)

      expect(optionLabels()).toContain('#12 Katherine Johnson')
      expect(wrapper.get('.base-select__value').text()).toBe('#12 Katherine Johnson')
    })

    it('degrades to the unknown label when even the cache has never seen it', async () => {
      const wrapper = await mountControl({ modelValue: 'rec_deleted' })
      await open(wrapper)

      expect(optionLabels()).toContain(UNKNOWN_RECORD_LABEL)
    })

    it('offers every unlisted link, not merely the first', async () => {
      const relations = useRelationsStore()
      Object.assign(relations.linkedByField[FIELD_ID]!, {
        rec_katherine: { number: 12, label: 'Katherine Johnson' },
        rec_dorothy: { number: 13, label: 'Dorothy Vaughan' },
      })

      const wrapper = await mountControl({
        multiple: true,
        modelValue: ['rec_ada', 'rec_katherine', 'rec_dorothy'],
      })
      await open(wrapper)

      expect(optionLabels()).toEqual(
        expect.arrayContaining(['#1 Ada Lovelace', '#12 Katherine Johnson', '#13 Dorothy Vaughan']),
      )
    })

    it('never repeats a link the seed already lists', async () => {
      const wrapper = await mountControl({ modelValue: 'rec_ada' })
      await open(wrapper)

      expect(optionLabels().filter((label) => label === '#1 Ada Lovelace')).toHaveLength(1)
    })
  })

  it('searches the target table and offers what comes back', async () => {
    const wrapper = await mountControl()

    await wrapper.get('.base-select__input').setValue('marg')
    await expect
      .poll(() => optionLabels(), { timeout: 2000 })
      .toEqual(expect.arrayContaining(['#3 Margaret Hamilton']))

    expect(panel()).not.toBeNull()
  })
})
