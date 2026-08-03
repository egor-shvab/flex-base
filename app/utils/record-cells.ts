import type { Component } from 'vue'
import type { IField } from '#shared/types/field'
import type { IRecord, TRecordValue } from '#shared/types/record'
import { FIELD_CELLS } from '~/field-types/cells'
import { RECORD_COLUMNS } from '~/field-types/record-columns'

/**
 * How a column of `queryFields` is read and drawn — shared by the table and the detail dialog,
 * so a value reads the same wherever it is shown. Key before type in both, mirroring the
 * precedence the server's `FIELD_SQL_BY_TYPE` lookup uses.
 */

/** A record's own column reads from the record; everything else from its data. */
export function cellValue(record: IRecord, column: IField): TRecordValue {
  return RECORD_COLUMNS[column.key]?.value(record) ?? record.data[column.key] ?? null
}

export function cellComponent(column: IField): Component {
  return RECORD_COLUMNS[column.key]?.cell ?? FIELD_CELLS[column.type]
}
