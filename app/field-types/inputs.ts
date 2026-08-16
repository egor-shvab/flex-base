import { markRaw } from 'vue'
import BaseCheckbox from '~/components/common/BaseCheckbox.vue'
import BaseInput from '~/components/common/BaseInput.vue'
import BaseSelect from '~/components/common/BaseSelect.vue'
import RelationFieldSelect from '~/field-types/controls/RelationFieldSelect.vue'
import type { IField, TFieldType } from '#shared/types/field'
import { choiceOptions, isMultiValue } from '#shared/utils/field'
import { toValueList } from '~/utils/record-value'
import { shouldSearch } from '~/utils/select'
import type { TRecordFieldControl } from '~/field-types/types'

/**
 * TEXT, DATE and SELECT all speak a plain string whose blank means "no value", never an
 * empty string — the one adapter the three of them share.
 */
const blankIsNull: Pick<TRecordFieldControl, 'toControl' | 'fromControl'> = {
  toControl: (value) => (typeof value === 'string' ? value : ''),
  fromControl: (model) => (typeof model === 'string' && model !== '' ? model : null),
}

/**
 * The multi-value counterpart, shared by every list control: the model is the stored array
 * itself, so both directions are a shape guard rather than a conversion — `toValueList` is where
 * the pre-migration scalar case is accounted for, for the cell and this control alike.
 */
const listValue: Pick<TRecordFieldControl, 'toControl' | 'fromControl'> = {
  toControl: (value) => toValueList(value),
  // Symmetric with `toControl` rather than `Array.isArray(model) ? model : []`. A control that
  // hands back a bare string is misconfigured, but discarding the value is the worst possible
  // response to that — it loses the user's edit with nothing on screen to show for it.
  fromControl: (model) => toValueList(model),
}

/**
 * What a SELECT offers, whether it holds one value or several. The two entries differ by
 * `multiple` alone, so they share this rather than restating six keys — and `choiceOptions` is
 * resolved **once** here, where each entry used to call it twice (for the list and for its length).
 *
 * `multiple` is omitted rather than set to `false` when a field holds one value: `BaseSelect` ties
 * the prop to its model's type, and an explicit `false` is a different claim from saying nothing.
 */
function selectProps(field: IField, multiple = false): Record<string, unknown> {
  const options = choiceOptions(field)

  return {
    label: field.name,
    // The choices carry their colour, so an option row can be tinted where an `<option>` could not
    options,
    // The registry knows how many choices there are, so the search box is its decision
    searchable: shouldSearch(options.length),
    // No blank option: a placeholder says "nothing chosen" without pretending to be a choice, and
    // `clearable` is how a value is taken back. A required field still relies on the schema.
    placeholder: '— Select —',
    clearable: true,
    emptyLabel: 'No choices defined',
    ...(multiple ? { multiple: true } : {}),
  }
}

/** The same for a relation picker, whose candidates the control fetches for itself. */
function relationProps(field: IField, multiple = false): Record<string, unknown> {
  return {
    label: field.name,
    fieldId: field.id,
    placeholder: '— Select —',
    clearable: true,
    ...(multiple ? { multiple: true } : {}),
  }
}

/**
 * The per-field-type branch point for editing a record. Typed as a total `Record`, so
 * adding a `FieldType` fails to compile until its input is declared — `DynamicForm` never
 * learns which types there are. Each entry is data, not a component: a `Base*` control,
 * a props factory, and the two adapters between the DOM's value and `TRecordValue`.
 *
 * Module scope + `markRaw` keep Vue from deep-proxying the component objects and stop the
 * map being rebuilt on every render.
 */
export const FIELD_INPUTS: Record<TFieldType, TRecordFieldControl> = {
  TEXT: {
    component: markRaw(BaseInput),
    props: (field) => ({ label: field.name, trim: true }),
    ...blankIsNull,
  },
  NUMBER: {
    component: markRaw(BaseInput),
    props: (field) => ({ label: field.name, type: 'number' }),
    toControl: (value) => (value === null || typeof value === 'object' ? '' : String(value)),
    fromControl: (model) => {
      if (typeof model !== 'string') return null

      const trimmed = model.trim()
      if (trimmed === '') return null

      // Unparseable input is kept as-is so the schema reports "Enter a number"
      const parsed = Number(trimmed)
      return Number.isNaN(parsed) ? trimmed : parsed
    },
  },
  BOOLEAN: {
    component: markRaw(BaseCheckbox),
    props: (field) => ({ label: field.name }),
    toControl: (value) => value === true,
    fromControl: (model) => model === true,
  },
  DATE: {
    component: markRaw(BaseInput),
    // A date input already speaks YYYY-MM-DD, which is exactly how dates are stored
    props: (field) => ({ label: field.name, type: 'date' }),
    ...blankIsNull,
  },
  SELECT: {
    component: markRaw(BaseSelect),
    props: (field) => selectProps(field),
    ...blankIsNull,
  },
  // The candidates come from the target table, so this one control fetches rather than
  // reading the field's metadata — the only entry whose component is not a `Base*` atom
  RELATION: {
    component: markRaw(RelationFieldSelect),
    props: (field) => relationProps(field),
    ...blankIsNull,
  },
}

/**
 * How a field is edited when it holds **several** values — the same control with `multiple`
 * set and the list adapter in place of the scalar one. Total for the same reason
 * `FIELD_INPUTS` is: a new field type declares whether it has a list form rather than
 * inheriting one by omission. `null` means it has none, which `MULTI_VALUE_BY_TYPE` already
 * refuses to configure.
 *
 * The control shows "3 selected" rather than a chip row: chips make a control's height a
 * function of its content, which `useAnchoredPosition` does not observe (`docs/decisions.md`).
 */
const MULTI_INPUTS: Record<TFieldType, TRecordFieldControl | null> = {
  TEXT: null,
  NUMBER: null,
  BOOLEAN: null,
  DATE: null,
  SELECT: {
    component: markRaw(BaseSelect),
    props: (field) => selectProps(field, true),
    ...listValue,
  },
  RELATION: {
    component: markRaw(RelationFieldSelect),
    props: (field) => relationProps(field, true),
    ...listValue,
  },
}

/**
 * The control that edits one field — the single place a field's cardinality is resolved on the
 * form side, so `DynamicForm` never learns that `multiple` exists any more than it knows which
 * field types there are.
 */
export function inputFor(field: IField): TRecordFieldControl {
  return (isMultiValue(field) ? MULTI_INPUTS[field.type] : null) ?? FIELD_INPUTS[field.type]
}
