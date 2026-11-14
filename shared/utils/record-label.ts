import { isMultiValue } from '#shared/field-types/cardinality'
import type { IField } from '#shared/types/field'
import type { ILinkedRecord, IRecord } from '#shared/types/record'

/**
 * Whether a field can be what a relation shows for each linked record. Not another relation (its
 * value is a cuid) and not a list. One rule for the form that offers fields and the server that
 * stores the choice.
 */
export function canLabelRecords(field: IField): boolean {
  return field.type !== 'RELATION' && !isMultiValue(field)
}

export function buildRecordLabel(
  record: Pick<IRecord, 'number' | 'data'>,
  labelFieldKey?: string,
): string | null {
  const value = labelFieldKey === undefined ? undefined : record.data[labelFieldKey]

  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(', ') : null
  }

  if (value === null || value === undefined || value === '') return null

  return String(value)
}

export function formatLinkedRecord(linked: ILinkedRecord): string {
  return linked.label === null ? `#${linked.number}` : `#${linked.number} ${linked.label}`
}
