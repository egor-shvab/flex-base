import { z } from 'zod'
import { DEFAULT_BADGE_COLOR } from '#shared/constants/color'
import type { IFieldTypeModule } from '#shared/field-types/types'
import type { TBadgeColor } from '#shared/types/color'
import type { IField } from '#shared/types/field'

/**
 * A SELECT's choices as bare strings — what the record schema validates against and what the
 * controls list. Several call sites read this, so the unwrapping lives here.
 */
export function choiceValues(field: IField): string[] {
  return (field.options?.choices ?? []).map((choice) => choice.value)
}

/**
 * A SELECT's choices as a picker offers them — `choiceValues` with the colour kept.
 * Structurally an `ISelectOption`, which is what puts a choice's hue in the form and the
 * drawer. A choice's `value` is also its label: its text is its identity (`docs/decisions.md`).
 */
export function choiceOptions(
  field: IField,
): { value: string; label: string; color: TBadgeColor }[] {
  return (field.options?.choices ?? []).map((choice) => ({
    value: choice.value,
    label: choice.value,
    color: choice.color,
  }))
}

/**
 * The colour a stored value renders in. A value the field no longer offers falls back to the
 * neutral default rather than disappearing, so a stale cell still shows its text.
 */
export function badgeColorFor(field: IField, value: string): TBadgeColor {
  return (
    field.options?.choices?.find((choice) => choice.value === value)?.color ?? DEFAULT_BADGE_COLOR
  )
}

/** The choices, shared by the single and list schemas so the two cannot drift. */
function choiceEnum(field: IField): z.ZodType<string> {
  return z.enum(choiceValues(field) as [string, ...string[]], 'Choose a value')
}

export const SELECT_FIELD_TYPE: IFieldTypeModule<'SELECT'> = {
  label: 'Select',
  // Several of the field's own choices at once
  multiValue: true,
  // Several choices at once, ORed in SQL. The empty *array* is what tells the control it is a
  // multi-select.
  filter: { shape: 'list', empty: [] },
  value: {
    base: choiceEnum,
    listBase: choiceEnum,
    blank: null,
    fromQuery: (raw) => raw,
  },
}
