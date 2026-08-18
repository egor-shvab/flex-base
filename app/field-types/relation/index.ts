import { markRaw } from 'vue'
import type { IField } from '#shared/types/field'
import { blankIsNull, listValue } from '~/field-types/adapters'
import RelationFieldCell from '~/field-types/relation/RelationFieldCell.vue'
import RelationFieldConfigSummary from '~/field-types/relation/RelationFieldConfigSummary.vue'
import RelationFieldSelect from '~/field-types/relation/RelationFieldSelect.vue'
import { summariseLinkedRecord, summariseList } from '~/field-types/prose'
import type { IAppFieldType } from '~/field-types/types'

/**
 * The relation picker, wherever it appears. The placeholder is the difference that matters —
 * "All" narrows a list, "— Select —" fills a field — and `multiple` is omitted rather than set
 * to `false` for a single-value field, because `BaseSelect` ties the prop to its model's type.
 *
 * The candidates come from the target table, so this one control fetches rather than reading
 * the field's metadata — the only entry whose component is not a `Base*` atom.
 */
function relationProps(
  field: IField,
  placeholder: string,
  multiple = false,
): Record<string, unknown> {
  return {
    label: field.name,
    fieldId: field.id,
    placeholder,
    clearable: true,
    ...(multiple ? { multiple: true } : {}),
  }
}

export const RELATION_APP_FIELD_TYPE: IAppFieldType<'RELATION'> = {
  input: {
    component: markRaw(RelationFieldSelect),
    props: (field) => relationProps(field, '— Select —'),
    ...blankIsNull,
  },
  multiInput: {
    component: markRaw(RelationFieldSelect),
    props: (field) => relationProps(field, '— Select —', true),
    ...listValue,
  },
  // The same picker the form uses, so a filter offers exactly what a record can link to.
  // Its model is already the filter value — the target record's id — so no adapters.
  filter: {
    component: markRaw(RelationFieldSelect),
    props: (field) => relationProps(field, 'All'),
  },
  // A field holding several values can only be asked whether it holds any of the filtered
  // ones, so its filter is list-shaped whatever its type says
  multiFilter: {
    component: markRaw(RelationFieldSelect),
    props: (field) => relationProps(field, 'All', true),
  },
  cell: markRaw(RelationFieldCell),
  // The only entry needing state beyond its own value. A filtered id outside the capped
  // candidate list resolves to nothing, and degrades the same way a cell does.
  summary: (value, field, ctx) => `is ${summariseLinkedRecord(ctx, field, String(value))}`,
  multiSummary: (value, field, ctx) =>
    summariseList(value, (id) => summariseLinkedRecord(ctx, field, id)),
  icon: 'mdi:link-variant',
  configSummary: markRaw(RelationFieldConfigSummary),
}
