import { DEFAULT_BADGE_COLOR } from '#shared/constants/color'
import type { TBadgeColor } from '#shared/types/color'
import type { IField } from '#shared/types/field'

/**
 * A SELECT's choices as bare strings — what the record schema validates against and what
 * the form and filter controls list. Three call sites read this shape, so the unwrapping
 * lives here rather than being mapped inline in each of them.
 */
export function choiceValues(field: IField): string[] {
  return (field.options?.choices ?? []).map((choice) => choice.value)
}

/**
 * The colour a stored value renders in. A value the field no longer offers — renamed or
 * deleted after records were written — falls back to the neutral default rather than
 * disappearing, so a stale cell still shows its text.
 */
export function badgeColorFor(field: IField, value: string): TBadgeColor {
  return (
    field.options?.choices?.find((choice) => choice.value === value)?.color ?? DEFAULT_BADGE_COLOR
  )
}
