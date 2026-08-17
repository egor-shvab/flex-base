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
import DynamicForm from '~/components/records/DynamicForm.vue'
import RelationFieldSelect from '~/field-types/controls/RelationFieldSelect.vue'
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
  return mountTracked(DynamicForm, { props: { fields, values, errors } })
}

type TForm = Awaited<ReturnType<typeof form>>

/** The `(key, value)` pairs the form has emitted upward. */
const updates = (wrapper: TForm) =>
  wrapper.emitted('update') as [string, TRecordValue][] | undefined
const lastUpdate = (wrapper: TForm) => updates(wrapper)?.at(-1)

describe('DynamicForm', () => {
  afterEach(unmountAll)

  // A RELATION field renders `RelationFieldSelect`, which reads the relations store
  beforeEach(() => setActivePinia(useNuxtApp().$pinia as Pinia))

  describe('which control each field gets', () => {
    it('renders one control per field, in field order', async () => {
      const wrapper = await form([textField('company'), numberField('total')])

      const labels = wrapper.findAll('label').map((label) => label.text())
      expect(labels).toEqual(['company', 'total'])
    })

    it('renders nothing at all for a table with no fields', async () => {
      const wrapper = await form([])

      expect(wrapper.get('.dynamic-form').element.children).toHaveLength(0)
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

  /** What pairs each label with its control, and what keeps two forms on one page apart. */
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

      // The `useId()` prefix is what keeps two forms on one page apart; asserting the
      // separation itself is not possible here, since `mountSuspended` gives each mount its
      // own app and restarts the counter
      expect(wrapper.get('input').attributes('id')).not.toBe('company')
      expect(wrapper.get('input').attributes('id')).toMatch(/^.+-company$/)
    })
  })

  /** Values flow down through the registry's `toControl`. */
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

    it('shows a multi SELECT’s selection as a count', async () => {
      const wrapper = await form([asMultiple(selectField(['Won', 'Lost']))], {
        stage: ['Won', 'Lost'],
      })

      expect(wrapper.get('.base-select__value').text()).toBe('2 selected')
    })
  })

  /** Changes flow up as events, converted by the registry's `fromControl`. */
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

    // The "unparseable input is kept as a string so the schema can say 'Enter a number'" rule
    // lives on the adapter and is covered in `inputs.nuxt.spec.ts`: it cannot be reached
    // through this component, because `type="number"` refuses the text before it ever reaches
    // the model.

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

    /**
     * The form object belongs to the parent's `useForm`: values flow down as props and changes
     * flow back up as events, so this component never writes to what it was given.
     */
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
