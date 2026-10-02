import { z } from 'zod'
import { DEFAULT_BADGE_COLOR } from '#shared/constants/color'
import type { IFieldTypeModule } from '#shared/field-types/types'
import type { TBadgeColor } from '#shared/types/color'
import type { IField } from '#shared/types/field'

export function choiceValues(field: IField): string[] {
  return (field.options?.choices ?? []).map((choice) => choice.value)
}

export function choiceOptions(
  field: IField,
): { value: string; label: string; color: TBadgeColor }[] {
  return (field.options?.choices ?? []).map((choice) => ({
    value: choice.value,
    label: choice.value,
    color: choice.color,
  }))
}

export function badgeColorFor(field: IField, value: string): TBadgeColor {
  return (
    field.options?.choices?.find((choice) => choice.value === value)?.color ?? DEFAULT_BADGE_COLOR
  )
}

function choiceEnum(field: IField): z.ZodType<string> {
  return z.enum(choiceValues(field) as [string, ...string[]], 'Choose a value')
}

export const SELECT_FIELD_TYPE: IFieldTypeModule<'SELECT'> = {
  label: 'Select',
  multiValue: true,
  filter: { shape: 'list', empty: [] },
  value: {
    base: choiceEnum,
    listBase: choiceEnum,
    blank: null,
    fromQuery: (raw) => raw,
  },
}
