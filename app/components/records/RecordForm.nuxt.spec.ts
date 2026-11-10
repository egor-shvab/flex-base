import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mountTracked, unmountAll } from '~~/test/mount'

import { useNuxtApp } from '#imports'
import { setActivePinia } from 'pinia'
import type { Pinia } from 'pinia'
import type { IField } from '#shared/types/field'
import type { TRecordData, TRecordValue } from '#shared/types/record'
import BaseCheckbox from '~/components/common/BaseCheckbox.vue'
import BaseInput from '~/components/common/BaseInput.vue'
import BaseSelect from '~/components/common/BaseSelect/BaseSelect.vue'
import RecordForm from '~/components/records/RecordForm.vue'
import RelationFieldSelect from '~/field-types/relation/RelationFieldSelect.vue'
import {
  asMultiple,
  booleanField,
  dateField,
  numberField,
  relationField,
  selectField,
  textField,
} from '~~/test/fixtures'

function form(
  fields: IField[],
  values: TRecordData = {},
  errors: Partial<Record<string, string>> = {},
) {
  return mountTracked(RecordForm, { props: { fields, values, errors } })
}

type TForm = Awaited<ReturnType<typeof form>>

const updates = (wrapper: TForm) =>
  wrapper.emitted('update') as [string, TRecordValue][] | undefined
const lastUpdate = (wrapper: TForm) => updates(wrapper)?.at(-1)

describe('RecordForm', () => {
  afterEach(unmountAll)

  beforeEach(() => setActivePinia(useNuxtApp().$pinia as Pinia))

  describe('which control each field gets', () => {
    it('renders one control per field, in field order', async () => {
      const wrapper = await form([textField('company'), numberField('total')])

      const labels = wrapper.findAll('label').map((label) => label.text())
      expect(labels).toEqual(['company', 'total'])
    })

    it('renders nothing at all for a table with no fields', async () => {
      const wrapper = await form([])

      expect(wrapper.get('.record-fields').element.children).toHaveLength(0)
    })

    it.each([
      ['TEXT', textField('company'), BaseInput],
      ['NUMBER', numberField('total'), BaseInput],
      ['DATE', dateField('signed_on'), BaseInput],
      ['BOOLEAN', booleanField('active'), BaseCheckbox],
      ['SELECT', selectField(), BaseSelect],
      ['RELATION', relationField(), RelationFieldSelect],
    ] as const)('edits a %s with the registry’s control', async (_type, field, component) => {
      const wrapper = await form([field])

      expect(wrapper.findComponent(component).exists()).toBe(true)
    })

    it('gives the two BaseInput variants their native input types', async () => {
      const wrapper = await form([
        textField('company'),
        numberField('total'),
        dateField('signed_on'),
      ])

      expect(wrapper.findAll('input').map((input) => input.attributes('type'))).toEqual([
        'text',
        'number',
        'date',
      ])
    })

    it('renders a widened SELECT as one control, not several', async () => {
      const wrapper = await form([asMultiple(selectField())])

      expect(wrapper.findAllComponents(BaseSelect)).toHaveLength(1)
    })
  })

  describe('control ids', () => {
    it('suffixes every id with the field key', async () => {
      const wrapper = await form([textField('company'), numberField('total')])

      const ids = wrapper.findAll('input').map((input) => input.attributes('id'))
      expect(ids[0]).toMatch(/-company$/)
      expect(ids[1]).toMatch(/-total$/)
    })

    it('shares one form prefix across its own controls', async () => {
      const wrapper = await form([textField('company'), numberField('total')])

      const prefixes = wrapper
        .findAll('input')
        .map((input) => input.attributes('id')?.replace(/-[^-]+$/, ''))

      expect(new Set(prefixes).size).toBe(1)
    })

    it('prefixes the key rather than using it alone', async () => {
      const wrapper = await form([textField('company')])

      // `mountSuspended` restarts the `useId()` counter per mount, so the separation itself is
      // untestable here
      expect(wrapper.get('input').attributes('id')).not.toBe('company')
      expect(wrapper.get('input').attributes('id')).toMatch(/^.+-company$/)
    })
  })

  describe('reading values in', () => {
    it('puts a stored string in the field', async () => {
      const wrapper = await form([textField('company')], { company: 'Acme' })

      expect(wrapper.get('input').element.value).toBe('Acme')
    })

    it('renders a stored number as text', async () => {
      const wrapper = await form([numberField('total')], { total: 1284 })

      expect(wrapper.get('input').element.value).toBe('1284')
    })

    it('ticks a checkbox only for a strict true', async () => {
      const checked = await form([booleanField('active')], { active: true })
      expect(checked.get('input').element.checked).toBe(true)

      const unchecked = await form([booleanField('active')], { active: null })
      expect(unchecked.get('input').element.checked).toBe(false)
    })

    it('leaves a control empty for a field the record has no value for', async () => {
      const wrapper = await form([textField('company')])

      expect(wrapper.get('input').element.value).toBe('')
    })

    it('shows a multi SELECT’s selection as its first value and a count', async () => {
      const wrapper = await form([asMultiple(selectField(['Won', 'Lost']))], {
        stage: ['Won', 'Lost'],
      })

      expect(wrapper.get('.base-select__value .base-badge').text()).toBe('Won')
      expect(wrapper.get('.base-select__more').text()).toBe('+1')
    })
  })

  describe('emitting changes out', () => {
    it('emits the field key with what the control produced', async () => {
      const wrapper = await form([textField('company')])

      await wrapper.get('input').setValue('Acme')

      expect(lastUpdate(wrapper)).toEqual(['company', 'Acme'])
    })

    it('converts a typed number rather than emitting the string', async () => {
      const wrapper = await form([numberField('total')])

      await wrapper.get('input').setValue('42')

      expect(lastUpdate(wrapper)).toEqual(['total', 42])
    })

    it('emits null when a value is cleared', async () => {
      const wrapper = await form([textField('company')], { company: 'Acme' })

      await wrapper.get('input').setValue('')

      expect(lastUpdate(wrapper)).toEqual(['company', null])
    })

    it('emits a boolean for a checkbox', async () => {
      const wrapper = await form([booleanField('active')])

      await wrapper.get('input').setValue(true)

      expect(lastUpdate(wrapper)).toEqual(['active', true])
    })

    it('emits only for the field that changed', async () => {
      const wrapper = await form([textField('company'), numberField('total')])

      await wrapper.findAll('input')[1]!.setValue('42')

      expect(updates(wrapper)).toHaveLength(1)
      expect(lastUpdate(wrapper)).toEqual(['total', 42])
    })

    it('never mutates the values it was handed', async () => {
      const values: TRecordData = { company: 'Acme' }
      const wrapper = await form([textField('company')], values)

      await wrapper.get('input').setValue('Globex')

      expect(values).toEqual({ company: 'Acme' })
    })
  })

  describe('errors', () => {
    it('shows an error against its own field and no other', async () => {
      const wrapper = await form(
        [textField('company'), numberField('total')],
        {},
        {
          company: 'Company is required',
        },
      )

      expect(wrapper.text()).toContain('Company is required')
      expect(wrapper.findAll('[aria-invalid="true"]')).toHaveLength(1)
    })

    it('marks the invalid control for assistive tech', async () => {
      const wrapper = await form([textField('company')], {}, { company: 'Company is required' })

      const input = wrapper.get('input')
      expect(input.attributes('aria-invalid')).toBe('true')
      expect(input.attributes('aria-describedby')).toBeTruthy()
    })

    it('marks nothing when there are no errors', async () => {
      const wrapper = await form([textField('company')])

      expect(wrapper.find('[aria-invalid="true"]').exists()).toBe(false)
    })
  })
})
