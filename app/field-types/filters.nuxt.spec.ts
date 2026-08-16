import { describe, expect, it } from 'vitest'
import BaseInput from '~/components/common/BaseInput.vue'
import BaseRange from '~/components/common/BaseRange.vue'
import BaseSelect from '~/components/common/BaseSelect.vue'
import { FIELD_TYPES } from '#shared/constants/field'
import type { TFieldType } from '#shared/types/field'
import RelationFieldSelect from '~/field-types/controls/RelationFieldSelect.vue'
import { FIELD_FILTERS, filterFor } from '~/field-types/filters'
import { QUERY_DEBOUNCE_MS } from '~/composables/useDebouncedModel'
import { shouldSearch } from '~/utils/select'
import {
  ALL_TYPE_FIELDS,
  asMultiple,
  booleanField,
  dateField,
  numberField,
  relationField,
  selectField,
  textField,
} from '~~/test/fixtures'

/**
 * In the Nuxt project only because the registry imports `.vue` control components. Nothing here
 * mounts anything — the entries are data.
 */
describe('FIELD_FILTERS', () => {
  it.each([
    ['TEXT', BaseInput],
    ['NUMBER', BaseRange],
    ['BOOLEAN', BaseSelect],
    ['DATE', BaseRange],
    ['SELECT', BaseSelect],
    ['RELATION', RelationFieldSelect],
  ] as const)('filters a %s with the right control', (type, component) => {
    expect(filterFor(ALL_TYPE_FIELDS[type as TFieldType]).component).toBe(component)
  })

  /**
   * No control knows an operator — the value is the whole contract, and `FILTER_VALUE_BY_TYPE`
   * maps it to conditions at the serialization boundary.
   */
  it('gives no control an operator to choose from', () => {
    for (const type of FIELD_TYPES) {
      const field = ALL_TYPE_FIELDS[type]
      const props = filterFor(field).props(field)

      expect(props.operator).toBeUndefined()
      expect(props.operators).toBeUndefined()
    }
  })
})

describe('filterFor', () => {
  /** A field holding several values can only be asked whether it holds *any* of the filtered. */
  it('gives a multi RELATION its own list control', () => {
    const single = relationField()
    const multi = asMultiple(relationField())

    expect(filterFor(multi)).not.toBe(FIELD_FILTERS.RELATION)
    expect(filterFor(multi).props(multi).multiple).toBe(true)
    expect(filterFor(single).props(single).multiple).toBeUndefined()
  })

  /**
   * The deliberate asymmetry with `inputFor`. A SELECT *filter* has always taken several
   * choices — picking two is a question about one stored value as much as about a list of them
   * — so `MULTI_FILTERS.SELECT` is `null` and the flat entry serves both. The invariant that
   * holds for `MULTI_INPUTS` ("non-null exactly where `MULTI_VALUE_BY_TYPE` is true") is
   * therefore **not** the invariant here, and making the two symmetric would double the
   * registry for no behaviour.
   */
  it('serves a multi SELECT from the flat entry, unlike the input side', () => {
    const multi = asMultiple(selectField())

    expect(filterFor(multi)).toBe(FIELD_FILTERS.SELECT)
    // It was already list-shaped, so it needed no second entry to become one
    expect(filterFor(selectField()).props(selectField()).multiple).toBe(true)
  })

  it('ignores multiple on a type that cannot hold several', () => {
    const field = asMultiple(textField())

    expect(filterFor(field)).toBe(FIELD_FILTERS.TEXT)
  })

  it('leaves every other type on its flat entry when widened', () => {
    for (const type of ['TEXT', 'NUMBER', 'BOOLEAN', 'DATE', 'SELECT'] as const) {
      expect(filterFor(asMultiple(ALL_TYPE_FIELDS[type]))).toBe(FIELD_FILTERS[type])
    }
  })
})

/**
 * Four of the six entries need no adapters at all: their control's model already **is** the
 * filter value. Adding a redundant pair is as much a regression as dropping a needed one.
 */
describe('adapters', () => {
  it.each(['TEXT', 'NUMBER', 'DATE', 'SELECT', 'RELATION'] as const)(
    'leaves %s unadapted, because its model is already the filter value',
    (type) => {
      const control = FIELD_FILTERS[type]

      expect(control.toControl).toBeUndefined()
      expect(control.fromControl).toBeUndefined()
    },
  )

  it('adapts BOOLEAN, the one control whose model is a different shape', () => {
    expect(FIELD_FILTERS.BOOLEAN.toControl).toBeTypeOf('function')
    expect(FIELD_FILTERS.BOOLEAN.fromControl).toBeTypeOf('function')
  })

  describe('BOOLEAN', () => {
    const { toControl, fromControl } = FIELD_FILTERS.BOOLEAN

    it('shows a filtered value as the control’s string', () => {
      expect(toControl!(true)).toBe('true')
      expect(toControl!(false)).toBe('false')
    })

    /**
     * A two-state control cannot express "either", so the *absence* of a choice carries it —
     * `null` is "All", and clearing emits `''`.
     */
    it('shows no choice at all for an unfiltered field', () => {
      expect(toControl!(null)).toBe('')
    })

    it('reads a choice back as a boolean', () => {
      expect(fromControl!('true')).toBe(true)
      expect(fromControl!('false')).toBe(false)
    })

    it('reads a cleared control back as All', () => {
      expect(fromControl!('')).toBeNull()
      expect(fromControl!(null)).toBeNull()
      expect(fromControl!('anything else')).toBeNull()
    })

    it('round-trips every state it can be in', () => {
      for (const value of [true, false, null] as const) {
        expect(fromControl!(toControl!(value))).toBe(value)
      }
    })
  })
})

describe('the props each control is handed', () => {
  it('always labels the control with the field name', () => {
    for (const type of FIELD_TYPES) {
      const field = ALL_TYPE_FIELDS[type]

      expect(filterFor(field).props(field).label).toBe(field.name)
    }
  })

  /**
   * A filter's blank means "every record", never "nothing chosen" — which is why the copy
   * differs from the form's `— Select —` on the same controls.
   */
  it.each([booleanField(), selectField(), relationField()])(
    'placeholders a clearable filter with All',
    (field) => {
      expect(filterFor(field).props(field).placeholder).toBe('All')
      expect(filterFor(field).props(field).clearable).toBe(true)
    },
  )

  /**
   * A typed query input must not hit the API on every keystroke. Asserted against the constant
   * rather than against `300`, for the reason the `shouldSearch` case below states: a restated
   * literal turns a design decision into a broken build the day the figure moves.
   */
  it.each([textField(), numberField(), dateField()])('debounces a typed filter', (field) => {
    expect(filterFor(field).props(field).debounce).toBe(QUERY_DEBOUNCE_MS)
  })

  it('leaves a picker undebounced, since a choice is not typed', () => {
    for (const field of [booleanField(), selectField(), relationField()]) {
      expect(filterFor(field).props(field).debounce).toBeUndefined()
    }
  })

  it('says what a TEXT filter does', () => {
    const field = textField()

    expect(filterFor(field).props(field).placeholder).toBe('Contains…')
    expect(filterFor(field).props(field).trim).toBe(true)
  })

  it('gives the two range filters their bound type', () => {
    expect(filterFor(numberField()).props(numberField()).type).toBe('number')
    expect(filterFor(dateField()).props(dateField()).type).toBe('date')
  })

  it('offers a BOOLEAN the same two words the cell uses', () => {
    const field = booleanField()

    expect(filterFor(field).props(field).options).toEqual([
      { value: 'true', label: 'Yes' },
      { value: 'false', label: 'No' },
    ])
  })

  /** The choices come from the field's own metadata, so the list needs no extra request. */
  it('hands a SELECT its choices, colours and all', () => {
    const field = selectField([
      { value: 'Won', color: 'green' },
      { value: 'Lost', color: 'red' },
    ])

    expect(filterFor(field).props(field).options).toEqual([
      { value: 'Won', label: 'Won', color: 'green' },
      { value: 'Lost', label: 'Lost', color: 'red' },
    ])
  })

  /**
   * Asserted against `shouldSearch` rather than against `true`/`false`, so the case pins that
   * the registry *consults* the predicate — moving the threshold is a design decision and must
   * not break a spec that has no opinion on where it sits. It still fails a hardcode: a
   * registry always answering `false` disagrees with `shouldSearch(20)`.
   */
  it('decides a SELECT’s search box by consulting shouldSearch', () => {
    const few = selectField(['a', 'b', 'c'])
    expect(filterFor(few).props(few).searchable).toBe(shouldSearch(3))

    const many = selectField(Array.from({ length: 20 }, (_, index) => `choice ${index}`))
    expect(filterFor(many).props(many).searchable).toBe(shouldSearch(20))
  })

  /** The same picker the form uses, so a filter offers exactly what a record can link to. */
  it('addresses a RELATION by its field id', () => {
    const field = relationField()

    expect(filterFor(field).props(field).fieldId).toBe(field.id)
  })
})
