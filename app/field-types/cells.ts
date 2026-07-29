import { markRaw, type Component } from 'vue'
import type { TFieldType } from '#shared/types/field'
import BooleanFieldCell from '~/field-types/cells/BooleanFieldCell.vue'
import DateFieldCell from '~/field-types/cells/DateFieldCell.vue'
import NumberFieldCell from '~/field-types/cells/NumberFieldCell.vue'
import RelationFieldCell from '~/field-types/cells/RelationFieldCell.vue'
import SelectFieldCell from '~/field-types/cells/SelectFieldCell.vue'
import TextFieldCell from '~/field-types/cells/TextFieldCell.vue'

/**
 * The per-field-type branch point for displaying a record. Typed as a total `Record`, so
 * adding a `FieldType` fails to compile until its cell exists — `DynamicTable` never
 * learns which types there are.
 *
 * Cells stay components rather than collapsing into a `format()` like the inputs did: a
 * boolean renders an icon and a number needs tabular figures, so they carry markup and
 * scoped styles, not just a string. Every one honours `IFieldCellProps`.
 */
export const FIELD_CELLS: Record<TFieldType, Component> = {
  TEXT: markRaw(TextFieldCell),
  NUMBER: markRaw(NumberFieldCell),
  BOOLEAN: markRaw(BooleanFieldCell),
  DATE: markRaw(DateFieldCell),
  SELECT: markRaw(SelectFieldCell),
  RELATION: markRaw(RelationFieldCell),
}
