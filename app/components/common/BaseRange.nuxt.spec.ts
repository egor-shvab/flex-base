import { afterEach, describe, expect, it } from 'vitest'

import type { IDateRange, INumberRange } from '#shared/types/range'
import BaseRange from '~/components/common/BaseRange.vue'
import { mountTracked, unmountAll } from '~~/test/mount'

const EMPTY: INumberRange = { from: null, to: null }

function range(
  props: {
    type?: 'number' | 'date'
    modelValue?: INumberRange | IDateRange
    label?: string
    debounce?: number
  } = {},
) {
  return mountTracked(BaseRange, {
    props: {
      id: 'salary',
      type: props.type ?? 'number',
      modelValue: props.modelValue ?? EMPTY,
      ...(props.label === undefined ? {} : { label: props.label }),
      ...(props.debounce === undefined ? {} : { debounce: props.debounce }),
    },
  })
}

type TRange = Awaited<ReturnType<typeof range>>

const bounds = (wrapper: TRange) => wrapper.findAll('input')
const from = (wrapper: TRange) => bounds(wrapper)[0]!
const to = (wrapper: TRange) => bounds(wrapper)[1]!
const lastModel = (wrapper: TRange) =>
  wrapper.emitted('update:modelValue')?.at(-1)?.[0] as INumberRange | IDateRange | undefined

describe('BaseRange', () => {
  afterEach(unmountAll)

  describe('structure', () => {
    it('groups the two bounds under one label', async () => {
      const wrapper = await range({ label: 'Salary' })

      const group = wrapper.get('[role="group"]')
      expect(group.attributes('aria-labelledby')).toBe('salary-label')
      expect(wrapper.get('#salary-label').text()).toBe('Salary')
    })

    it('leaves the group unlabelled when the range has no label of its own', async () => {
      const wrapper = await range()

      expect(wrapper.get('[role="group"]').attributes('aria-labelledby')).toBeUndefined()
      expect(wrapper.find('label').exists()).toBe(false)
    })

    /** Each bound names itself, since the visible label belongs to the group around them. */
    it('names each bound for assistive tech', async () => {
      const wrapper = await range({ label: 'Salary' })

      expect(from(wrapper).attributes('aria-label')).toBe('From')
      expect(to(wrapper).attributes('aria-label')).toBe('To')
    })

    it('suffixes each bound’s id, and points the label at the first', async () => {
      const wrapper = await range({ label: 'Salary' })

      expect(from(wrapper).attributes('id')).toBe('salary-from')
      expect(to(wrapper).attributes('id')).toBe('salary-to')
      expect(wrapper.get('label').attributes('for')).toBe('salary-from')
    })

    it.each(['number', 'date'] as const)('gives both bounds the %s input type', async (type) => {
      const wrapper = await range({ type })

      expect(bounds(wrapper).map((input) => input.attributes('type'))).toEqual([type, type])
    })
  })

  describe('reading a bound', () => {
    /**
     * The rule the whole filter rests on: an empty box is **no bound**, never `0`. A zero would
     * turn a blank field into `>= 0` and silently narrow the table.
     */
    it('reads a blank box as no bound rather than zero', async () => {
      const wrapper = await range({ modelValue: { from: 10, to: 20 } })

      await from(wrapper).setValue('')

      expect(lastModel(wrapper)).toEqual({ from: null, to: 20 })
      expect(lastModel(wrapper)?.from).not.toBe(0)
    })

    /**
     * A `type="number"` input yields `''` for anything it cannot represent, so the text never
     * reaches the draft; `toBound`'s `trim` and `Number.isFinite` are the belt to that brace.
     */
    it('ends up with no bound for text a number box cannot hold', async () => {
      const wrapper = await range()

      await from(wrapper).setValue('not a number')

      expect(from(wrapper).element.value).toBe('')
      expect(lastModel(wrapper)?.from ?? null).toBeNull()
    })

    it('parses a real number, zero included', async () => {
      const wrapper = await range()

      await from(wrapper).setValue('1500')
      expect(lastModel(wrapper)).toEqual({ from: 1500, to: null })

      await from(wrapper).setValue('0')
      expect(lastModel(wrapper)).toEqual({ from: 0, to: null })
    })

    it('parses a negative and a decimal', async () => {
      const wrapper = await range()

      await from(wrapper).setValue('-4.5')

      expect(lastModel(wrapper)).toEqual({ from: -4.5, to: null })
    })

    /** A date input already speaks `YYYY-MM-DD`, so its round trip is lossless. */
    it('passes a date through as its own string', async () => {
      const wrapper = await range({ type: 'date' })

      await from(wrapper).setValue('2026-01-05')

      expect(lastModel(wrapper)).toEqual({ from: '2026-01-05', to: null })
    })
  })

  describe('the two bounds together', () => {
    /** Both are re-read from the drafts on every edit, so one never discards the other. */
    it('keeps the other bound when one is edited', async () => {
      const wrapper = await range()

      await from(wrapper).setValue('10')
      await to(wrapper).setValue('20')

      expect(lastModel(wrapper)).toEqual({ from: 10, to: 20 })
    })

    it('lets an upper bound stand alone', async () => {
      const wrapper = await range()

      await to(wrapper).setValue('20')

      expect(lastModel(wrapper)).toEqual({ from: null, to: 20 })
    })

    it('clears back to an empty range', async () => {
      const wrapper = await range({ modelValue: { from: 10, to: 20 } })

      await from(wrapper).setValue('')
      await to(wrapper).setValue('')

      expect(lastModel(wrapper)).toEqual(EMPTY)
    })
  })

  /**
   * The displayed text is kept rather than derived from the bound: re-deriving it would rewrite
   * the field mid-typing. This is what the two drafts exist for.
   */
  describe('the displayed text', () => {
    it('shows a bound the model arrived with', async () => {
      const wrapper = await range({ modelValue: { from: 1500, to: null } })

      expect(from(wrapper).element.value).toBe('1500')
      expect(to(wrapper).element.value).toBe('')
    })

    it('does not collapse trailing zeros under the user', async () => {
      const wrapper = await range()

      await from(wrapper).setValue('1.50')

      // The model rounds the value; the field must not
      expect(lastModel(wrapper)?.from).toBe(1.5)
      expect(from(wrapper).element.value).toBe('1.50')
    })

    it('leaves the text alone when an incoming bound agrees with it', async () => {
      const wrapper = await range()
      await from(wrapper).setValue('1.50')

      // The same number, written differently — resyncing here would undo the edit in progress
      await wrapper.setProps({ modelValue: { from: 1.5, to: null } })

      expect(from(wrapper).element.value).toBe('1.50')
    })

    /** Clear all, a shared URL, the back button — the model has other authors. */
    it('takes an outside change that disagrees with it', async () => {
      const wrapper = await range()
      await from(wrapper).setValue('10')

      await wrapper.setProps({ modelValue: { from: 99, to: 200 } })

      expect(from(wrapper).element.value).toBe('99')
      expect(to(wrapper).element.value).toBe('200')
    })

    it('empties both boxes when the range is cleared from outside', async () => {
      const wrapper = await range({ modelValue: { from: 10, to: 20 } })

      await wrapper.setProps({ modelValue: EMPTY })

      expect(from(wrapper).element.value).toBe('')
      expect(to(wrapper).element.value).toBe('')
    })
  })

  /** A range filter costs a request per edit, so the delay is forwarded to both bounds. */
  it('forwards its debounce to both bounds', async () => {
    const wrapper = await range({ debounce: 300 })

    expect(wrapper.findAllComponents({ name: 'BaseInput' })).toHaveLength(2)
    for (const input of wrapper.findAllComponents({ name: 'BaseInput' })) {
      expect(input.props('debounce')).toBe(300)
    }
  })
})
