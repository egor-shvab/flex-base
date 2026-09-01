import { markRaw } from 'vue'
import type { IField } from '#shared/types/field'
import { blankIsNull, listValue } from '~/field-types/adapters'
import RelationFieldCell from '~/field-types/relation/RelationFieldCell.vue'
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
  valueBy: 'id' | 'number' = 'id',
): Record<string, unknown> {
  return {
    label: field.name,
    fieldId: field.id,
    placeholder,
    clearable: true,
    valueBy,
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
  // The same picker the form uses, so a filter offers exactly what a record can link to — but
  // its model is the target's **number**, because that is what a filter puts in the URL. The
  // server resolves it back to an id before the SQL sees it (`decisions.md`).
  filter: {
    component: markRaw(RelationFieldSelect),
    props: (field) => relationProps(field, 'All', false, 'number'),
  },
  // A field holding several values can only be asked whether it holds any of the filtered
  // ones, so its filter is list-shaped whatever its type says
  multiFilter: {
    component: markRaw(RelationFieldSelect),
    props: (field) => relationProps(field, 'All', true, 'number'),
  },
  cell: markRaw(RelationFieldCell),
  // The only filter summary needing state beyond its own value. A filtered id outside the
  // capped candidate list resolves to nothing, and degrades the same way a cell does.
  summary: (value, field, ctx) => `is ${summariseLinkedRecord(ctx, field, String(value))}`,
  multiSummary: (value, field, ctx) =>
    summariseList(value, (id) => summariseLinkedRecord(ctx, field, id)),
  icon: 'mdi:link-variant',
  // The one config summary needing state beyond its field, for the same reason the filter
  // summary above does: the target's *name* is not in the metadata, only its id.
  //
  // The fallback is a phrase, never blank. `ensureTables` never throws, so the store may hold
  // nothing at all — and the caller has already drawn the separator in front of this by the
  // time that is known, so an empty string would leave it dangling.
  configSummary: (field, ctx) => {
    const targetTableId = field.options?.targetTableId
    const name = targetTableId === undefined ? undefined : ctx.tableName(targetTableId)

    return `links to ${name ?? 'another table'}`
  },
}
