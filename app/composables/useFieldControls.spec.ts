import { describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { useFieldControls } from '~/composables/useFieldControls'
import type { IField } from '#shared/types/field'
import type { TFilterValue } from '#shared/types/filter'
import type { IFieldControl } from '~/field-types/types'
import { textField } from '~~/test/fixtures'

const DUMMY = defineComponent({})

function resolving(
  props: (field: IField) => Record<string, unknown>,
): () => IFieldControl<TFilterValue> {
  return () => ({ component: DUMMY, props })
}

describe('useFieldControls', () => {
  it('builds one entry per field, in field order, with its props already resolved', () => {
    const fields = [
      textField('company', { name: 'Company' }),
      textField('stage', { name: 'Stage' }),
    ]

    const controls = useFieldControls(
      () => fields,
      resolving((field) => ({ label: field.name })),
    )

    expect(controls.value.map((control) => control.field.key)).toEqual(['company', 'stage'])
    expect(controls.value.map((control) => control.props)).toEqual([
      { label: 'Company' },
      { label: 'Stage' },
    ])
    expect(controls.value[0]?.component).toBe(DUMMY)
  })

  it('calls each props factory once per resolution, not once per read', () => {
    const propsFactory = vi.fn((field: IField) => ({ label: field.name }))
    const fields = [textField('company'), textField('stage')]

    const controls = useFieldControls(() => fields, resolving(propsFactory))

    expect(controls.value).toHaveLength(fields.length)
    expect(controls.value).toHaveLength(fields.length)
    expect(controls.value).toHaveLength(fields.length)

    expect(propsFactory).toHaveBeenCalledTimes(fields.length)
  })

  it('re-resolves when the field list changes', () => {
    const propsFactory = vi.fn((field: IField) => ({ label: field.name }))
    const fields = ref<IField[]>([textField('company')])

    const controls = useFieldControls(() => fields.value, resolving(propsFactory))

    expect(controls.value).toHaveLength(1)

    fields.value = [textField('company'), textField('stage')]

    expect(controls.value).toHaveLength(2)
    expect(propsFactory).toHaveBeenCalledTimes(3)
  })

  it('carries adapters through, and leaves an absent one absent', () => {
    const toControl = (value: TFilterValue) => value
    const fromControl = (model: TFilterValue) => model

    const adapting = useFieldControls(
      () => [textField('company')],
      () => ({
        component: DUMMY,
        props: () => ({}),
        toControl,
        fromControl,
      }),
    )

    expect(adapting.value[0]?.toControl).toBe(toControl)
    expect(adapting.value[0]?.fromControl).toBe(fromControl)

    const plain = useFieldControls(
      () => [textField('company')],
      resolving(() => ({})),
    )

    expect(plain.value[0]?.toControl).toBeUndefined()
    expect(plain.value[0]?.fromControl).toBeUndefined()
  })
})
