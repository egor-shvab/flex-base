import { markRaw, type Component } from 'vue'
import { CREATED_AT_KEY, RECORD_NUMBER_KEY, UPDATED_AT_KEY } from '#shared/constants/filter'
import type { IRecord, TRecordSingleValue } from '#shared/types/record'
import RecordNumberCell from '~/field-types/cells/RecordNumberCell.vue'
import TimestampCell from '~/field-types/cells/TimestampCell.vue'

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
 * The client half of the record-column registry, keyed by the same reserved keys the query
 * layer uses (`shared/utils/filter.ts`). `RecordsTable` looks a column up here first and falls
 * through to the field-type registries for everything else, so it never learns which columns
 * exist — the same shape as `FIELD_CELLS` for types.
 */
export const RECORD_COLUMNS: Record<string, IRecordColumn> = {
  [RECORD_NUMBER_KEY]: { value: (record) => record.number, cell: markRaw(RecordNumberCell) },
  [CREATED_AT_KEY]: { value: (record) => record.createdAt, cell: markRaw(TimestampCell) },
  [UPDATED_AT_KEY]: { value: (record) => record.updatedAt, cell: markRaw(TimestampCell) },
}
