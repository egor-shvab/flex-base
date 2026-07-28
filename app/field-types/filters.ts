import { markRaw } from 'vue'
import BaseInput from '~/components/common/BaseInput.vue'
import BaseRange from '~/components/common/BaseRange.vue'
import BaseSelect from '~/components/common/BaseSelect.vue'
import type { TFieldType } from '#shared/types/field'
import type { IFilterValueByType } from '#shared/types/filter'
import type { IFieldControl } from '~/field-types/types'

/** A typed query input must not hit the API on every keystroke. */
const FILTER_DEBOUNCE_MS = 300

const BOOLEAN_FILTER_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
]

/**
 * The per-field-type branch point for filtering, and the only place the filter panel
 * learns that field types exist. Typed as a total `Record`, so adding a `FieldType` fails
 * to compile until its control is declared.
 *
 * **No control knows an operator** — the value is the whole contract, and
 * `FILTER_VALUE_BY_TYPE` maps it to conditions at the serialization boundary. Four of the
 * six entries need no adapters: their control's model already *is* the filter value.
 */
export const FIELD_FILTERS: { [K in TFieldType]: IFieldControl<IFilterValueByType[K]> } = {
  TEXT: {
    component: markRaw(BaseInput),
    props: (field) => ({
      label: field.name,
      placeholder: 'Contains…',
      debounce: FILTER_DEBOUNCE_MS,
      trim: true,
    }),
  },
  NUMBER: {
    component: markRaw(BaseRange),
    props: (field) => ({ label: field.name, type: 'number', debounce: FILTER_DEBOUNCE_MS }),
  },
  BOOLEAN: {
    component: markRaw(BaseSelect),
    props: (field) => ({ label: field.name, options: BOOLEAN_FILTER_OPTIONS }),
    // A `<select>` speaks strings, and `null` is "All" — a two-state control cannot
    // express "either", so the absent choice has to carry it.
    toControl: (value) => (value === null ? '' : String(value)),
    fromControl: (model) => (model === 'true' ? true : model === 'false' ? false : null),
  },
  DATE: {
    component: markRaw(BaseRange),
    props: (field) => ({ label: field.name, type: 'date', debounce: FILTER_DEBOUNCE_MS }),
  },
  SELECT: {
    component: markRaw(BaseSelect),
    props: (field) => ({
      label: field.name,
      // The choices come from the field's own metadata, so the list needs no extra request
      options: [
        { value: '', label: 'All' },
        ...(field.options?.choices ?? []).map((choice) => ({ value: choice, label: choice })),
      ],
    }),
  },
  // RELATION is not creatable yet — a text filter is a placeholder until that milestone
  RELATION: {
    component: markRaw(BaseInput),
    props: (field) => ({ label: field.name, debounce: FILTER_DEBOUNCE_MS, trim: true }),
  },
}
