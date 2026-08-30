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
 * How a column of `queryColumns` is read and drawn — shared by the table and the detail dialog, so
 * a value reads the same wherever it is shown. Key before type in both, mirroring the precedence
 * the server's `FIELD_SQL_BY_TYPE` lookup uses. A caller goes through these rather than indexing a
 * registry, so it never learns which record columns exist or which fields hold a list.
 *
 * **This is the one resolver that does not live in the registry, and the reason is a cycle.**
 * `inputFor`, `filterFor` and `summaryFor` all sit in `registry.ts` — but `cellComponent` returns
 * `MultiValueCell`, and that component imports `FIELD_CELLS` back out of `registry.ts` to render
 * each entry. Folding this in would make the two import each other. `registry.ts` naming only the
 * six per-type modules, never the shared cell, is what keeps this directory acyclic
 * (`docs/decisions.md`).
 *
 * `RECORD_COLUMNS` is the key half of that precedence, and lives here rather than in a module of
 * its own because both resolvers below read it on their first line and nothing else reads it.
 *
 * Only the registry-reading half lives here. The value shapers it pairs with — `toValueList` and
 * `toCellSingleValue` — are pure, and live together in `~/utils/value-shape`.
 */

interface IRecordColumn {
  /**
   * Where the value comes from: a column of the record itself, never a key of its `data` —
   * and therefore always exactly one value, whatever the table's own fields do.
   */
  value: (record: IRecord) => TRecordSingleValue
  /** What renders it, since a field type's own cell cannot know about these columns. */
  cell: Component
}

/**
 * The client half of the record-column registry, keyed by the same reserved keys the query layer
 * uses (`shared/utils/filter.ts`) — the same shape as `FIELD_CELLS` is for types.
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
 * Key, then cardinality, then type. A multi-value field renders through one shared cell that
 * delegates each entry back to `FIELD_CELLS`, so the registry needs no list variants and a
 * value reads the same whether it stands alone or in a list.
 */
export function cellComponent(column: IField): Component {
  const recordColumn = RECORD_COLUMNS[column.key]
  if (recordColumn) return recordColumn.cell

  return isMultiValue(column) ? MULTI_VALUE_CELL : FIELD_CELLS[column.type]
}
