import { markRaw } from 'vue'
import BaseCheckbox from '~/components/common/BaseCheckbox.vue'
import BaseInput from '~/components/common/BaseInput.vue'
import BaseSelect from '~/components/common/BaseSelect.vue'
import RelationFieldSelect from '~/field-types/controls/RelationFieldSelect.vue'
import type { IField, TFieldType } from '#shared/types/field'
import type { TFilterValue } from '#shared/types/filter'
import { choiceOptions, isMultiValue } from '#shared/utils/field'
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
 * itself, so both directions are a shape guard rather than a conversion.
 *
 * `toControl` also accepts a bare string, which is what a record written **before** its field
 * was widened still holds — the migration in `updateField` rewrites those rows, but a form
 * opened from a stale page must not drop the value it is about to save back.
 */
const listValue: Pick<TRecordFieldControl, 'toControl' | 'fromControl'> = {
  toControl: (value) => toList(value),
  // Symmetric with `toControl` rather than `Array.isArray(model) ? model : []`. A control that
  // hands back a bare string is misconfigured, but discarding the value is the worst possible
  // response to that — it loses the user's edit with nothing on screen to show for it.
  fromControl: (model) => toList(model),
}

/**
 * The stored array, however the value arrives. A bare string is what a record written **before**
 * its field was widened still holds — the migration in `updateField` rewrites those rows, but a
 * form opened from a stale page must not drop the value it is about to save back.
 */
function toList(value: TFilterValue): string[] {
  if (Array.isArray(value)) return value

  return typeof value === 'string' && value !== '' ? [value] : []
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
    props: (field) => ({
      label: field.name,
      // No blank option: a placeholder says "nothing chosen" without pretending to be a
      // choice, and `clearable` is how a value is taken back. A required field still relies
      // on the schema to reject the empty case.
      // The choices carry their colour now — an option row can be tinted where an
      // `<option>` could not be.
      options: choiceOptions(field),
      // The registry knows how many choices there are, so the search box is its decision
      searchable: shouldSearch(choiceOptions(field).length),
      placeholder: '— Select —',
      clearable: true,
      emptyLabel: 'No choices defined',
    }),
    ...blankIsNull,
  },
  // The candidates come from the target table, so this one control fetches rather than
  // reading the field's metadata — the only entry whose component is not a `Base*` atom
  RELATION: {
    component: markRaw(RelationFieldSelect),
    props: (field) => ({
      label: field.name,
      fieldId: field.id,
      placeholder: '— Select —',
      clearable: true,
    }),
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
    props: (field) => ({
      label: field.name,
      options: choiceOptions(field),
      searchable: shouldSearch(choiceOptions(field).length),
      multiple: true,
      placeholder: '— Select —',
      clearable: true,
      emptyLabel: 'No choices defined',
    }),
    ...listValue,
  },
  RELATION: {
    component: markRaw(RelationFieldSelect),
    props: (field) => ({
      label: field.name,
      fieldId: field.id,
      multiple: true,
      placeholder: '— Select —',
      clearable: true,
    }),
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
