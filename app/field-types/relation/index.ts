import { markRaw } from 'vue'
import type { IField } from '#shared/types/field'
import { blankIsNull, listValue } from '~/field-types/adapters'
import RelationFieldCell from '~/field-types/relation/RelationFieldCell.vue'
import RelationFieldSelect from '~/field-types/relation/RelationFieldSelect.vue'
import { summariseLinkedRecord, summariseList } from '~/field-types/prose'
import type { IAppFieldType } from '~/field-types/types'

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
  filter: {
    component: markRaw(RelationFieldSelect),
    props: (field) => relationProps(field, 'All', false, 'number'),
  },
  multiFilter: {
    component: markRaw(RelationFieldSelect),
    props: (field) => relationProps(field, 'All', true, 'number'),
  },
  cell: markRaw(RelationFieldCell),
  summary: (value, field, ctx) => `is ${summariseLinkedRecord(ctx, field, String(value))}`,
  multiSummary: (value, field, ctx) =>
    summariseList(value, (id) => summariseLinkedRecord(ctx, field, id)),
  icon: 'material-symbols:arrow-outward-rounded',
  align: 'start',
  configSummary: (field, ctx) => {
    const targetTableId = field.options?.targetTableId
    const name = targetTableId === undefined ? undefined : ctx.tableName(targetTableId)

    return `links to ${name ?? 'another table'}`
  },
}
