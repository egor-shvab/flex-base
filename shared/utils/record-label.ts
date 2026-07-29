import { UNTITLED_RECORD_LABEL } from '#shared/constants/record'
import type { TRecordData } from '#shared/types/record'

/**
 * How a record reads when something links to it. The label field is named by the relation
 * field's own `options.labelFieldKey`, so resolving a label needs no metadata beyond the
 * record itself — and a key that no longer exists simply falls back rather than failing.
 */
export function buildRecordLabel(data: TRecordData, labelFieldKey?: string): string {
  const value = labelFieldKey === undefined ? undefined : data[labelFieldKey]

  if (value === null || value === undefined || value === '') return UNTITLED_RECORD_LABEL

  return String(value)
}
