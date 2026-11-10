import { markRaw, type Component } from 'vue'
import { CREATED_AT_KEY, RECORD_NUMBER_KEY, UPDATED_AT_KEY } from '#shared/constants/filter'
import { isMultiValue } from '#shared/field-types/cardinality'
import type { IField } from '#shared/types/field'
import type { IRecord, TRecordSingleValue, TRecordValue } from '#shared/types/record'
import { FIELD_CELLS } from '~/field-types/registry'
import MultiValueCell from '~/field-types/cells/MultiValueCell.vue'
import RecordNumberCell from '~/field-types/cells/RecordNumberCell.vue'
import TimestampCell from '~/field-types/cells/TimestampCell.vue'

/**
 * Not in the registry because of a cycle: `MultiValueCell` imports `FIELD_CELLS` back out of
 * `registry.ts`.
 */

interface IRecordColumn {
  value: (record: IRecord) => TRecordSingleValue
  cell: Component
}

export const RECORD_COLUMNS: Record<string, IRecordColumn> = {
  [RECORD_NUMBER_KEY]: { value: (record) => record.number, cell: markRaw(RecordNumberCell) },
  [CREATED_AT_KEY]: { value: (record) => record.createdAt, cell: markRaw(TimestampCell) },
  [UPDATED_AT_KEY]: { value: (record) => record.updatedAt, cell: markRaw(TimestampCell) },
}

const MULTI_VALUE_CELL = markRaw(MultiValueCell)

export function readCellValue(record: IRecord, column: IField): TRecordValue {
  return RECORD_COLUMNS[column.key]?.value(record) ?? record.data[column.key] ?? null
}

export function cellComponent(column: IField): Component {
  const recordColumn = RECORD_COLUMNS[column.key]
  if (recordColumn) return recordColumn.cell

  return isMultiValue(column) ? MULTI_VALUE_CELL : FIELD_CELLS[column.type]
}
