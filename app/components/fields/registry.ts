import { markRaw, type Component } from 'vue'
import type { TFieldType } from '#shared/types/field'
import TextFieldInput from '~/components/fields/TextFieldInput.vue'
import TextFieldCell from '~/components/fields/TextFieldCell.vue'
import TextFieldFilter from '~/components/fields/TextFieldFilter.vue'
import NumberFieldInput from '~/components/fields/NumberFieldInput.vue'
import NumberFieldCell from '~/components/fields/NumberFieldCell.vue'
import NumberFieldFilter from '~/components/fields/NumberFieldFilter.vue'
import BooleanFieldInput from '~/components/fields/BooleanFieldInput.vue'
import BooleanFieldCell from '~/components/fields/BooleanFieldCell.vue'
import BooleanFieldFilter from '~/components/fields/BooleanFieldFilter.vue'
import DateFieldInput from '~/components/fields/DateFieldInput.vue'
import DateFieldCell from '~/components/fields/DateFieldCell.vue'
import DateFieldFilter from '~/components/fields/DateFieldFilter.vue'
import SelectFieldInput from '~/components/fields/SelectFieldInput.vue'
import SelectFieldCell from '~/components/fields/SelectFieldCell.vue'
import SelectFieldFilter from '~/components/fields/SelectFieldFilter.vue'

export interface IFieldComponents {
  /** Form input, following IFieldInputProps + v-model of TRecordValue. */
  input: Component
  /** Table cell, following IFieldCellProps. */
  cell: Component
  /** Filter control, following IFieldFilterProps + v-model of the type's filter value. */
  filter: Component
}

/**
 * The single per-field-type branch point for the UI. Typed as a total `Record`, so
 * adding a `FieldType` fails to compile until its components exist — `DynamicForm`,
 * `DynamicTable` and `RecordsFilterPanel` never need to know which types there are.
 *
 * `markRaw` keeps Vue from deep-proxying the component objects.
 */
export const FIELD_COMPONENTS: Record<TFieldType, IFieldComponents> = {
  TEXT: {
    input: markRaw(TextFieldInput),
    cell: markRaw(TextFieldCell),
    filter: markRaw(TextFieldFilter),
  },
  NUMBER: {
    input: markRaw(NumberFieldInput),
    cell: markRaw(NumberFieldCell),
    filter: markRaw(NumberFieldFilter),
  },
  BOOLEAN: {
    input: markRaw(BooleanFieldInput),
    cell: markRaw(BooleanFieldCell),
    filter: markRaw(BooleanFieldFilter),
  },
  DATE: {
    input: markRaw(DateFieldInput),
    cell: markRaw(DateFieldCell),
    filter: markRaw(DateFieldFilter),
  },
  SELECT: {
    input: markRaw(SelectFieldInput),
    cell: markRaw(SelectFieldCell),
    filter: markRaw(SelectFieldFilter),
  },
  // RELATION is not creatable yet — the text trio is a placeholder until that milestone
  RELATION: {
    input: markRaw(TextFieldInput),
    cell: markRaw(TextFieldCell),
    filter: markRaw(TextFieldFilter),
  },
}
