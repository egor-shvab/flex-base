import { describe, expect, it } from 'vitest'
import BaseCheckbox from '~/components/common/BaseCheckbox.vue'
import BaseInput from '~/components/common/BaseInput.vue'
import BaseSelect from '~/components/common/BaseSelect.vue'
import { FIELD_TYPES, MULTI_VALUE_BY_TYPE } from '#shared/constants/field'
import type { TFieldType } from '#shared/types/field'
import type { TFilterValue } from '#shared/types/filter'
import RelationFieldSelect from '~/field-types/controls/RelationFieldSelect.vue'
import { FIELD_INPUTS, inputFor } from '~/field-types/inputs'
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
 * mounts anything — the entries are data, and the adapters are pure functions.
 */
describe('FIELD_INPUTS', () => {
  it.each([
    ['TEXT', BaseInput],
    ['NUMBER', BaseInput],
    ['BOOLEAN', BaseCheckbox],
    ['DATE', BaseInput],
    ['SELECT', BaseSelect],
    ['RELATION', RelationFieldSelect],
  ] as const)('edits a %s with the right control', (type, component) => {
    expect(inputFor(ALL_TYPE_FIELDS[type as TFieldType]).component).toBe(component)
  })
})

/**
 * Cardinality is per-field, not per-type, so this resolver is the single place the form side
 * reads `options.multiple` — `DynamicForm` never learns the flag exists.
 */
describe('inputFor', () => {
  it('keeps the same control but swaps the adapter for a multi SELECT', () => {
    const single = inputFor(selectField())
    const multi = inputFor(asMultiple(selectField()))

    expect(multi.component).toBe(single.component)
    expect(multi.fromControl).not.toBe(single.fromControl)
  })

  it('marks a multi control as multiple, and a single one not', () => {
    expect(inputFor(asMultiple(selectField())).props(asMultiple(selectField())).multiple).toBe(true)
    expect(inputFor(selectField()).props(selectField()).multiple).toBeUndefined()

    const relation = asMultiple(relationField())
    expect(inputFor(relation).props(relation).multiple).toBe(true)
  })

  /** `MULTI_VALUE_BY_TYPE.TEXT` is false, so the flag alone must not reroute the lookup. */
  it('ignores multiple on a type that cannot hold several', () => {
    const field = asMultiple(textField())

    expect(inputFor(field)).toBe(FIELD_INPUTS.TEXT)
    expect(inputFor(field).props(field).multiple).toBeUndefined()
  })

  /**
   * Two total `Record`s maintained by hand in different files. Nothing but this says they have
   * to agree — a type marked multi-value with no list input would fall back to the scalar one
   * and silently drop every value but the first.
   */
  it('offers a list control for exactly the types that may hold a list', () => {
    for (const type of FIELD_TYPES) {
      const field = asMultiple(ALL_TYPE_FIELDS[type])
      const differs = inputFor(field) !== FIELD_INPUTS[type]

      expect(differs).toBe(MULTI_VALUE_BY_TYPE[type])
    }
  })
})

describe('the props each control is handed', () => {
  it('always labels the control with the field name', () => {
    for (const type of FIELD_TYPES) {
      const field = ALL_TYPE_FIELDS[type]

      expect(inputFor(field).props(field).label).toBe(field.name)
    }
  })

  it('gives the two BaseInput variants their native types', () => {
    expect(inputFor(numberField()).props(numberField()).type).toBe('number')
    // A date input already speaks YYYY-MM-DD, which is exactly how dates are stored
    expect(inputFor(dateField()).props(dateField()).type).toBe('date')
    expect(inputFor(textField()).props(textField()).type).toBeUndefined()
  })

  it('trims a TEXT field', () => {
    expect(inputFor(textField()).props(textField()).trim).toBe(true)
  })

  it('hands a SELECT its choices, colours and all', () => {
    const field = selectField([
      { value: 'Won', color: 'green' },
      { value: 'Lost', color: 'red' },
    ])

    expect(inputFor(field).props(field).options).toEqual([
      { value: 'Won', label: 'Won', color: 'green' },
      { value: 'Lost', label: 'Lost', color: 'red' },
    ])
  })

  /**
   * The registry knows how many choices there are, so the search box is its decision — but
   * *where* the line sits is `shouldSearch`'s, and `app/utils/select.spec.ts` pins that.
   * Asserting agreement rather than `true`/`false` keeps the threshold in one place while
   * still failing a registry that hardcodes the answer.
   */
  it('decides a SELECT’s search box by consulting shouldSearch', () => {
    const few = selectField(['a', 'b', 'c'])
    expect(inputFor(few).props(few).searchable).toBe(shouldSearch(3))

    const many = selectField(Array.from({ length: 20 }, (_, index) => `choice ${index}`))
    expect(inputFor(many).props(many).searchable).toBe(shouldSearch(20))
  })

  it('offers a SELECT copy for a field with no choices at all', () => {
    const field = selectField([])

    expect(inputFor(field).props(field).options).toEqual([])
    expect(inputFor(field).props(field).emptyLabel).toBe('No choices defined')
  })

  /** A relation's candidates are records of another table, so the control fetches by field id. */
  it('addresses a RELATION by its field id rather than its metadata', () => {
    const field = relationField()

    expect(inputFor(field).props(field).fieldId).toBe(field.id)
  })

  it('lets a value be taken back where a blank is meaningful', () => {
    for (const field of [selectField(), relationField()]) {
      expect(inputFor(field).props(field).clearable).toBe(true)
    }
  })
})

describe('the adapters', () => {
  /** TEXT, DATE and SELECT share one: a blank means "no value", never an empty string. */
  describe('blankIsNull, shared by TEXT, DATE and SELECT', () => {
    it.each([textField(), dateField(), selectField()])('reads a stored value in', (field) => {
      const { toControl } = inputFor(field)

      expect(toControl('stored')).toBe('stored')
      expect(toControl(null)).toBe('')
      // A control speaks strings; anything else is not this field's value
      expect(toControl(42)).toBe('')
      expect(toControl(['a'])).toBe('')
    })

    it.each([textField(), dateField(), selectField()])('writes a blank back as null', (field) => {
      const { fromControl } = inputFor(field)

      expect(fromControl('typed')).toBe('typed')
      expect(fromControl('')).toBeNull()
      expect(fromControl(null)).toBeNull()
    })
  })

  describe('NUMBER', () => {
    const { toControl, fromControl } = inputFor(numberField())

    it('shows a stored number as text', () => {
      expect(toControl(42)).toBe('42')
      expect(toControl(0)).toBe('0')
      expect(toControl(-4.5)).toBe('-4.5')
    })

    it('shows nothing for a value it cannot render', () => {
      expect(toControl(null)).toBe('')
      expect(toControl(['a'])).toBe('')
    })

    it('parses what the user typed', () => {
      expect(fromControl('42')).toBe(42)
      expect(fromControl('4.5')).toBe(4.5)
      expect(fromControl('-7')).toBe(-7)
      expect(fromControl('  42  ')).toBe(42)
    })

    it('treats an empty or whitespace-only field as no value', () => {
      expect(fromControl('')).toBeNull()
      expect(fromControl('   ')).toBeNull()
      expect(fromControl(null)).toBeNull()
    })

    /**
     * The load-bearing one. Discarding unparseable text would blank the field under the user
     * and leave the schema nothing to complain about — so it is kept as a string and validation
     * answers "Enter a number".
     */
    it('keeps unparseable input so the schema can reject it', () => {
      expect(fromControl('abc')).toBe('abc')
      expect(fromControl('12abc')).toBe('12abc')
    })
  })

  describe('BOOLEAN', () => {
    const { toControl, fromControl } = inputFor(booleanField())

    it('is true only for a strict true, in both directions', () => {
      expect(toControl(true)).toBe(true)
      expect(fromControl(true)).toBe(true)

      for (const value of [false, null, '', 'true', 1] as const) {
        expect(toControl(value)).toBe(false)
        expect(fromControl(value)).toBe(false)
      }
    })
  })

  describe('listValue, shared by every multi-value control', () => {
    const { toControl, fromControl } = inputFor(asMultiple(selectField()))

    it('passes a stored list straight through', () => {
      expect(toControl(['a', 'b'])).toEqual(['a', 'b'])
      expect(fromControl(['a', 'b'])).toEqual(['a', 'b'])
    })

    /**
     * A record written **before** its field was widened still holds a bare string. `updateField`
     * migrates those rows, but a form opened from a stale page must not drop the value it is
     * about to save back — so both directions wrap rather than discard.
     */
    it('wraps a bare string left over from before the field was widened', () => {
      expect(toControl('a')).toEqual(['a'])
      expect(fromControl('a')).toEqual(['a'])
    })

    it('reads a blank as an empty list', () => {
      for (const value of ['', null] as const) {
        expect(toControl(value)).toEqual([])
        expect(fromControl(value)).toEqual([])
      }
    })

    it('is symmetric, so a round trip changes nothing', () => {
      const stored: TFilterValue[] = [['a', 'b'], 'a', '', null]

      for (const value of stored) {
        expect(fromControl(toControl(value))).toEqual(fromControl(value))
      }
    })
  })
})
