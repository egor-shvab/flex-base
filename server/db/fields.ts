import type { Prisma } from '#server/generated/prisma/client'
import type { IField, IFieldOptions } from '#shared/types/field'

export const fieldSelect = {
  id: true,
  name: true,
  key: true,
  type: true,
  required: true,
  options: true,
  order: true,
  indexed: true,
} satisfies Prisma.FieldSelect

export type TFieldRow = Prisma.FieldGetPayload<{ select: typeof fieldSelect }>

/**
 * Narrows Prisma's untyped `options` JSON — the single place that cast is allowed, so no
 * call site has to trust the raw column.
 */
export function toFieldOptions(options: TFieldRow['options']): IFieldOptions | null {
  return (options as IFieldOptions | null) ?? null
}

/** The same, for a whole row: the shape every layer above the database speaks. */
export function toSharedField(field: TFieldRow): IField {
  return { ...field, options: toFieldOptions(field.options) }
}
