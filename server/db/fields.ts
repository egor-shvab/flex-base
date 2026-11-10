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

export function toFieldOptions(options: TFieldRow['options']): IFieldOptions | null {
  return (options as IFieldOptions | null) ?? null
}

export function toSharedField(field: TFieldRow): IField {
  return { ...field, options: toFieldOptions(field.options) }
}
