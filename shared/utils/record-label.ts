import type { ILinkedRecord, IRecord } from '#shared/types/record'

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
