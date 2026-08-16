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
 * The list a multi-value column renders, normalised — **the one place a stored value that is
 * not yet an array is accounted for.** `updateField` migrates a field's rows when it is
 * widened, so a bare scalar only survives in a page drawn before that ran; handling it here
 * rather than in the cell is what lets `IMultiValueCellProps.value` be a plain `string[]`.
 *
 * Pairs with `cellComponent`: whenever that returns `MultiValueCell`, this is the value.
 */
export function toCellValueList(value: TRecordValue): string[] {
  if (Array.isArray(value)) return value

  return typeof value === 'string' && value !== '' ? [value] : []
}

/** The counterpart for every other cell, which renders exactly one value. */
export function toCellSingleValue(value: TRecordValue): TRecordSingleValue {
  return Array.isArray(value) ? (value[0] ?? null) : value
}
