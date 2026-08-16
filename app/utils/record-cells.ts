import { markRaw, type Component } from 'vue'
import type { IField } from '#shared/types/field'
import type { IRecord, TRecordSingleValue, TRecordValue } from '#shared/types/record'
import { isMultiValue } from '#shared/utils/field'
import { FIELD_CELLS } from '~/field-types/cells'
import MultiValueCell from '~/field-types/cells/MultiValueCell.vue'
import { RECORD_COLUMNS } from '~/field-types/record-columns'

/** Module scope + `markRaw`, like the registries themselves — never a deep-proxied component. */
const MULTI_VALUE_CELL = markRaw(MultiValueCell)

/**
 * How a column of `queryColumns` is read and drawn — shared by the table and the detail dialog,
 * so a value reads the same wherever it is shown. Key before type in both, mirroring the
 * precedence the server's `FIELD_SQL_BY_TYPE` lookup uses.
 */

/** A record's own column reads from the record; everything else from its data. */
export function readCellValue(record: IRecord, column: IField): TRecordValue {
  return RECORD_COLUMNS[column.key]?.value(record) ?? record.data[column.key] ?? null
}

/**
 * Key, then cardinality, then type. A multi-value field renders through one shared cell that
 * delegates each entry back to `FIELD_CELLS`, so the registry needs no list variants and a
 * value reads the same whether it stands alone or in a list.
 */
export function cellComponent(column: IField): Component {
  const recordColumn = RECORD_COLUMNS[column.key]
  if (recordColumn) return recordColumn.cell

  return isMultiValue(column) ? MULTI_VALUE_CELL : FIELD_CELLS[column.type]
}

/**
 * The counterpart for every other cell, which renders exactly one value.
 *
 * Its list-shaped sibling is `toValueList` (`~/utils/record-value`), which the form control shares:
 * whenever `cellComponent` returns `MultiValueCell`, that is the value.
 */
export function toCellSingleValue(value: TRecordValue): TRecordSingleValue {
  return Array.isArray(value) ? (value[0] ?? null) : value
}
