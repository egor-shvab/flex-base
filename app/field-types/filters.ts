import { markRaw } from 'vue'
import BaseInput from '~/components/common/BaseInput.vue'
import BaseRange from '~/components/common/BaseRange.vue'
import BaseSelect from '~/components/common/BaseSelect.vue'
import RelationFieldSelect from '~/field-types/controls/RelationFieldSelect.vue'
import { BOOLEAN_LABELS } from '#shared/constants/field'
import type { IField, TFieldType } from '#shared/types/field'
import type { IFilterValueByType, TFilterValue } from '#shared/types/filter'
import { choiceOptions, isMultiValue } from '#shared/utils/field'
import { shouldSearch } from '~/utils/select'
import type { IFieldControl } from '~/field-types/types'

/** A typed query input must not hit the API on every keystroke. */
const FILTER_DEBOUNCE_MS = 300

const BOOLEAN_FILTER_OPTIONS = [
  { value: 'true', label: BOOLEAN_LABELS.true },
  { value: 'false', label: BOOLEAN_LABELS.false },
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
    props: (field) => ({
      label: field.name,
      options: BOOLEAN_FILTER_OPTIONS,
      placeholder: 'All',
      clearable: true,
    }),
    // The control speaks strings, and `null` is "All" — a two-state control cannot express
    // "either", so the *absence* of a choice carries it. Clearing emits `''`, which is why
    // these two adapters are unchanged by the move off a native `<select>`.
    toControl: (value) => (value === null ? '' : String(value)),
    fromControl: (model) => (model === 'true' ? true : model === 'false' ? false : null),
  },
  DATE: {
    component: markRaw(BaseRange),
    props: (field) => ({ label: field.name, type: 'date', debounce: FILTER_DEBOUNCE_MS }),
  },
  // The only list-shaped filter: several choices at once, ORed. No adapters, because the
  // control's model already *is* the filter value — `string[]` on both sides.
  SELECT: {
    component: markRaw(BaseSelect),
    props: (field) => ({
      label: field.name,
      // The choices come from the field's own metadata, so the list needs no extra request
      options: choiceOptions(field),
      // The registry knows how many choices there are, so the search box is its decision
      searchable: shouldSearch(choiceOptions(field).length),
      multiple: true,
      placeholder: 'All',
      clearable: true,
      emptyLabel: 'No choices defined',
    }),
  },
  // The same picker the form uses, so a filter offers exactly what a record can link to.
  // Its model is already the filter value — the target record's id — so no adapters.
  RELATION: {
    component: markRaw(RelationFieldSelect),
    props: (field) => ({
      label: field.name,
      fieldId: field.id,
      placeholder: 'All',
      clearable: true,
    }),
  },
}

/**
 * How a **multi-value** field is filtered. A field holding several values can only be asked
 * whether it holds any of the filtered ones, so its filter is list-shaped whatever its type
 * says — which SELECT's already was, leaving RELATION as the only entry that has to move.
 *
 * Total, like every other per-type map here; `null` is "this type has no list form".
 */
const MULTI_FILTERS: Record<TFieldType, IFieldControl<TFilterValue> | null> = {
  TEXT: null,
  NUMBER: null,
  BOOLEAN: null,
  DATE: null,
  // Unchanged from the single-value entry: a SELECT filter has always taken several choices,
  // because picking two is a question about one stored value as much as about a list of them
  SELECT: null,
  RELATION: {
    component: markRaw(RelationFieldSelect),
    props: (field) => ({
      label: field.name,
      fieldId: field.id,
      multiple: true,
      placeholder: 'All',
      clearable: true,
    }),
  },
}

/**
 * The control that filters one field — the filter-side twin of `inputFor`, and the only place
 * the drawer's cardinality branch lives.
 */
export function filterFor(field: IField): IFieldControl<TFilterValue> {
  return (isMultiValue(field) ? MULTI_FILTERS[field.type] : null) ?? FIELD_FILTERS[field.type]
}
