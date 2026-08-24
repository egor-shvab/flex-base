import { describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { useFieldControls } from '~/composables/useFieldControls'
import type { IField } from '#shared/types/field'
import type { TFilterValue } from '#shared/types/filter'
import type { IFieldControl } from '~/field-types/types'
import { textField } from '~~/test/fixtures'

/**
 * The seam both metadata renderers resolve their controls through. A plain `*.spec.ts`: the
 * composable creates one `computed` and nothing else, so it needs no Nuxt runtime and no DOM —
 * the resolver is handed in, which is what keeps the registries (and their `.vue` cells) out of
 * the import graph (`CLAUDE.md` §10).
 */
const DUMMY = defineComponent({})

/**
 * A resolver answering with the same adapter-free entry for every field — the shape a filter
 * control usually has. The `props` factory is closed over, so a spy on it counts every build.
 */
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

  /**
   * The whole reason this is a composable rather than two inline maps: `props` is a **factory**,
   * and it must run once per change of the field list rather than on every render. Both renderers
   * used to assert that in a comment apiece, where nothing checked it.
   */
  it('calls each props factory once per resolution, not once per read', () => {
    const propsFactory = vi.fn((field: IField) => ({ label: field.name }))
    const fields = [textField('company'), textField('stage')]

    const controls = useFieldControls(() => fields, resolving(propsFactory))

    // Three reads of the same unchanged list — only the first may build anything
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

  /**
   * Adapters ride along untouched, and a control supplying neither keeps them absent — the
   * composable must not default them to identity, or `TRecordFieldControl`'s guarantee that a
   * record input always adapts would stop meaning anything (`docs/decisions.md`).
   */
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
