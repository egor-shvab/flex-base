import type { Prisma } from '#server/generated/prisma/client'
import { recordBackgroundFailure } from '#server/utils/error-log-file'
import type { IField, IFieldOptions } from '#shared/types/field'
import { storedFieldOptionsSchema } from '#shared/validation/field'

export const fieldSelect = {
  id: true,
  name: true,
  key: true,
  type: true,
  required: true,
  options: true,
  order: true,
  indexed: true,
  updatedAt: true,
} satisfies Prisma.FieldSelect

export type TFieldRow = Prisma.FieldGetPayload<{ select: typeof fieldSelect }>

const reportedFieldIds = new Set<string>()

/**
 * A malformed `options` reads as none — every reader already handles a field without choices or a
 * target — and is recorded once per field and process, not on every request that loads it.
 */
export function toFieldOptions(
  fieldId: string,
  options: TFieldRow['options'],
): IFieldOptions | null {
  if (options === null) return null

  const parsed = storedFieldOptionsSchema.safeParse(options)
  if (parsed.success) return parsed.data

  if (!reportedFieldIds.has(fieldId)) {
    reportedFieldIds.add(fieldId)
    recordBackgroundFailure(new Error(`Field ${fieldId} has malformed options; read as none`))
  }
  return null
}

export function toSharedField(field: TFieldRow): IField {
  return {
    ...field,
    options: toFieldOptions(field.id, field.options),
    updatedAt: field.updatedAt.toISOString(),
  }
}
