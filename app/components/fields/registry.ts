import { markRaw, type Component } from 'vue'
import type { TFieldType } from '#shared/types/field'
import TextFieldInput from '~/components/fields/TextFieldInput.vue'
import TextFieldCell from '~/components/fields/TextFieldCell.vue'
import NumberFieldInput from '~/components/fields/NumberFieldInput.vue'
import NumberFieldCell from '~/components/fields/NumberFieldCell.vue'
import BooleanFieldInput from '~/components/fields/BooleanFieldInput.vue'
import BooleanFieldCell from '~/components/fields/BooleanFieldCell.vue'
import DateFieldInput from '~/components/fields/DateFieldInput.vue'
import DateFieldCell from '~/components/fields/DateFieldCell.vue'
import SelectFieldInput from '~/components/fields/SelectFieldInput.vue'
import SelectFieldCell from '~/components/fields/SelectFieldCell.vue'

export interface IFieldComponents {
  /** Form input, following IFieldInputProps + v-model of TRecordValue. */
  input: Component
  /** Table cell, following IFieldCellProps. */
  cell: Component
}

/**
 * The single per-field-type branch point for the UI. Typed as a total `Record`, so
 * adding a `FieldType` fails to compile until its components exist — `DynamicForm`
 * and `DynamicTable` never need to know which types there are.
 *
 * `markRaw` keeps Vue from deep-proxying the component objects.
 */
export const FIELD_COMPONENTS: Record<TFieldType, IFieldComponents> = {
  TEXT: { input: markRaw(TextFieldInput), cell: markRaw(TextFieldCell) },
  NUMBER: { input: markRaw(NumberFieldInput), cell: markRaw(NumberFieldCell) },
  BOOLEAN: { input: markRaw(BooleanFieldInput), cell: markRaw(BooleanFieldCell) },
  DATE: { input: markRaw(DateFieldInput), cell: markRaw(DateFieldCell) },
  SELECT: { input: markRaw(SelectFieldInput), cell: markRaw(SelectFieldCell) },
  // RELATION is not creatable yet — the text pair is a placeholder until that milestone
  RELATION: { input: markRaw(TextFieldInput), cell: markRaw(TextFieldCell) },
}
