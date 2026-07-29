import type { IRecord } from '#shared/types/record'

/**
 * How a record reads when something links to it. The label field is named by the relation
 * field's own `options.labelFieldKey`, so resolving a label needs no metadata beyond the
 * record itself — and a blank or deleted label field falls back to the record's number,
 * which keeps two unlabelled records distinguishable in a picker.
 */
export function buildRecordLabel(
  record: Pick<IRecord, 'number' | 'data'>,
  labelFieldKey?: string,
): string {
  const value = labelFieldKey === undefined ? undefined : record.data[labelFieldKey]

  if (value === null || value === undefined || value === '') return `#${record.number}`

  return String(value)
}
