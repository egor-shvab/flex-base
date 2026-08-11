import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { useNuxtApp } from '#imports'
import { setActivePinia } from 'pinia'
import type { Pinia } from 'pinia'
import { nextTick } from 'vue'
import { UNKNOWN_RECORD_LABEL } from '#shared/constants/record'
import RelationFieldSelect from '~/field-types/controls/RelationFieldSelect.vue'
import { useRelationsStore } from '~/stores/relations'
import { mountTracked, unmountAll } from '~~/test/mount'

/**
 * The one field-type control that is a component rather than data, and the only one that
 * fetches on user input. Every other entry in `FIELD_INPUTS` / `FIELD_FILTERS` names a `Base*`
 * control and a `props(field)` factory; a relation's candidates are records of another table,
 * which no synchronous factory can produce.
 *
 * Mounted against the real `BaseSelect` rather than a stub — the seam under test is the two
 * typed model proxies handing it the shape its generic expects, which a stub would not check.
 */
const FIELD_ID = 'fld_owner'

const SEED = [
  { id: 'rec_ada', label: 'Ada Lovelace' },
  { id: 'rec_grace', label: 'Grace Hopper' },
]

/** `searchOptions` needs a seeded `tableIdByField`, or it short-circuits to `[]`. */
registerEndpoint('/api/tables/tbl_people/fields/fld_owner/options', () => ({
  options: [{ id: 'rec_margaret', label: 'Margaret Hamilton' }],
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
    relations.labelsByField = {
      [FIELD_ID]: Object.fromEntries(SEED.map((option) => [option.id, option.label])),
    }
    relations.tableIdByField = { [FIELD_ID]: 'tbl_people' }

    document.body.innerHTML = ''
  })

  /**
   * Two branches rather than one select bound to a union, because `BaseSelect` ties `multiple`
   * to its model's own type on purpose. Which branch renders is fixed for the control's
   * lifetime, so the focused element never swaps out from under the user.
   */
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

    /** Both branches search: the seed list is capped, so anything past it is reached by name. */
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

    /**
     * A single-value field whose value arrives as a one-element list — what a field narrowed
     * back down would hand it. Reading `[0]` rather than rejecting keeps the form openable.
     */
    it('reads the first entry when a single model arrives as a list', async () => {
      const wrapper = await mountControl({ modelValue: ['rec_grace'] })

      expect(wrapper.get('.base-select__value').text()).toBe('Grace Hopper')
    })
  })

  /**
   * The load-bearing one. A link the capped seed does not include — a target beyond the listed
   * page, one reached through a search, or one since deleted — is still offered as an option,
   * or opening the form and saving it would silently drop the link.
   */
  describe('a link the seed list does not offer', () => {
    it('is still offered, labelled from the cache', async () => {
      const relations = useRelationsStore()
      relations.labelsByField[FIELD_ID]!.rec_katherine = 'Katherine Johnson'

      const wrapper = await mountControl({ modelValue: 'rec_katherine' })
      await open(wrapper)

      expect(optionLabels()).toContain('Katherine Johnson')
      expect(wrapper.get('.base-select__value').text()).toBe('Katherine Johnson')
    })

    it('degrades to the unknown label when even the cache has never seen it', async () => {
      const wrapper = await mountControl({ modelValue: 'rec_deleted' })
      await open(wrapper)

      expect(optionLabels()).toContain(UNKNOWN_RECORD_LABEL)
    })

    /** Every link is checked, not just the first: dropping one of three is as lossy as one. */
    it('offers every unlisted link, not merely the first', async () => {
      const relations = useRelationsStore()
      Object.assign(relations.labelsByField[FIELD_ID]!, {
        rec_katherine: 'Katherine Johnson',
        rec_dorothy: 'Dorothy Vaughan',
      })

      const wrapper = await mountControl({
        multiple: true,
        modelValue: ['rec_ada', 'rec_katherine', 'rec_dorothy'],
      })
      await open(wrapper)

      expect(optionLabels()).toEqual(
        expect.arrayContaining(['Ada Lovelace', 'Katherine Johnson', 'Dorothy Vaughan']),
      )
    })

    it('never repeats a link the seed already lists', async () => {
      const wrapper = await mountControl({ modelValue: 'rec_ada' })
      await open(wrapper)

      expect(optionLabels().filter((label) => label === 'Ada Lovelace')).toHaveLength(1)
    })
  })

  /** Typing reaches the server, because the seed is a page rather than the whole table. */
  it('searches the target table and offers what comes back', async () => {
    const wrapper = await mountControl()

    await wrapper.get('.base-select__input').setValue('marg')
    // The control debounces, then resolves — poll rather than count ticks
    await expect
      .poll(() => optionLabels(), { timeout: 2000 })
      .toEqual(expect.arrayContaining(['Margaret Hamilton']))

    expect(panel()).not.toBeNull()
  })
})
