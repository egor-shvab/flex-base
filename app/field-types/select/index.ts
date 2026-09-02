import { markRaw } from 'vue'
import BaseSelect from '~/components/common/BaseSelect/BaseSelect.vue'
import { choiceOptions, choiceValues } from '#shared/field-types/select'
import type { IField } from '#shared/types/field'
import { blankIsNull, listValue } from '~/field-types/adapters'
import SelectFieldCell from '~/field-types/select/SelectFieldCell.vue'
import { summariseList } from '~/field-types/prose'
import type { IAppFieldType } from '~/field-types/types'
import { shouldSearch } from '~/utils/select'

/**
 * What a SELECT offers, editing or filtering, one value or several. The entries differ by
 * `multiple` and placeholder alone, and `choiceOptions` is resolved **once** per call — for the
 * list and for the count that decides the search box.
 *
 * `multiple` is omitted rather than set to `false` for a single value: `BaseSelect` ties the
 * prop to its model's type, and an explicit `false` is a different claim from saying nothing.
 */
function selectProps(
  field: IField,
  placeholder: string,
  multiple = false,
): Record<string, unknown> {
  const options = choiceOptions(field)

  return {
    label: field.name,
    // The choices carry their colour, so an option row can be tinted where an `<option>` could not
    options,
    // The registry knows how many choices there are, so the search box is its decision
    searchable: shouldSearch(options.length),
    // No blank option: a placeholder says "nothing chosen" without posing as a choice, and
    // `clearable` takes a value back. A required field still relies on the schema.
    placeholder,
    clearable: true,
    emptyLabel: 'No choices defined',
    ...(multiple ? { multiple: true } : {}),
  }
}

export const SELECT_APP_FIELD_TYPE: IAppFieldType<'SELECT'> = {
  input: {
    component: markRaw(BaseSelect),
    props: (field) => selectProps(field, '— Select —'),
    ...blankIsNull,
  },
  // "3 selected" rather than a chip row: chips make a control's height a function of its
  // content, which `useAnchoredPosition` does not observe (`docs/decisions.md`).
  multiInput: {
    component: markRaw(BaseSelect),
    props: (field) => selectProps(field, '— Select —', true),
    ...listValue,
  },
  // The only list-shaped filter a single-value field has: several choices at once, ORed. No
  // adapters — the control's model already *is* the filter value, `string[]` on both sides.
  filter: {
    component: markRaw(BaseSelect),
    props: (field) => selectProps(field, 'All', true),
  },
  // Unchanged from the single-value entry: picking two choices is the same question about one
  // stored value as about a list of them
  multiFilter: null,
  cell: markRaw(SelectFieldCell),
  // Always list-shaped: a choice is its own text, so a filtered value needs no resolving
  summary: (value) => summariseList(value, (choice) => choice),
  // The summary already reads as a list, for the same reason `multiFilter` is `null`
  multiSummary: null,
  icon: 'mdi:form-dropdown',
  // Through `choiceValues`, so a field with missing or malformed options counts 0 rather than
  // rendering nothing
  configSummary: (field) => {
    const count = choiceValues(field).length

    return `${count} ${count === 1 ? 'choice' : 'choices'}`
  },
}
