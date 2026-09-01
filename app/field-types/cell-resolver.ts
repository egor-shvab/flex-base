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
 * How a column of `queryColumns` is read and drawn — shared by the table and the detail dialog.
 * Key before type in both, mirroring the server's `FIELD_SQL_BY_TYPE` precedence, so a caller
 * never learns which record columns exist or which fields hold a list.
 *
 * **The one resolver that does not live in the registry, because of a cycle:** `cellComponent`
 * returns `MultiValueCell`, which imports `FIELD_CELLS` back out of `registry.ts`. Keeping that
 * file to the six per-type modules is what holds this directory acyclic (`docs/decisions.md`).
 *
 * `RECORD_COLUMNS` lives here because both resolvers read it and nothing else does. The value
 * shapers it pairs with are pure and live in `~/utils/value-shape`.
 */

interface IRecordColumn {
  /**
   * A column of the record itself, never a key of its `data` — so always exactly one value.
   */
  value: (record: IRecord) => TRecordSingleValue
  /** What renders it, since a field type's own cell cannot know about these columns. */
  cell: Component
}

/**
 * The client half of the record-column registry, keyed by the reserved keys the query layer
 * uses (`shared/utils/filter.ts`).
 */
export const RECORD_COLUMNS: Record<string, IRecordColumn> = {
  [RECORD_NUMBER_KEY]: { value: (record) => record.number, cell: markRaw(RecordNumberCell) },
  [CREATED_AT_KEY]: { value: (record) => record.createdAt, cell: markRaw(TimestampCell) },
  [UPDATED_AT_KEY]: { value: (record) => record.updatedAt, cell: markRaw(TimestampCell) },
}

/** Module scope + `markRaw`, like the registries themselves — never a deep-proxied component. */
const MULTI_VALUE_CELL = markRaw(MultiValueCell)

/** A record's own column reads from the record; everything else from its data. */
export function readCellValue(record: IRecord, column: IField): TRecordValue {
  return RECORD_COLUMNS[column.key]?.value(record) ?? record.data[column.key] ?? null
}

/**
 * Key, then cardinality, then type. A multi-value field renders through one shared cell
 * delegating each entry back to `FIELD_CELLS`, so the registry needs no list variants.
 */
export function cellComponent(column: IField): Component {
  const recordColumn = RECORD_COLUMNS[column.key]
  if (recordColumn) return recordColumn.cell

  return isMultiValue(column) ? MULTI_VALUE_CELL : FIELD_CELLS[column.type]
}
