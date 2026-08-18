import type { FIELD_TYPES } from '#shared/field-types/registry'
import type { TBadgeColor } from '#shared/types/color'

export type TFieldType = (typeof FIELD_TYPES)[number]

/**
 * One SELECT option. `value` is both the label and the identity: a record stores this
 * string, so renaming a choice orphans the records already holding the old one — the same
 * behaviour as before colours existed (see `docs/decisions.md`).
 */
export interface IFieldChoice {
  value: string
  color: TBadgeColor
}

export interface IFieldOptions {
  choices?: IFieldChoice[]
  /** RELATION: the table its values point at. Immutable — changing it would orphan every id. */
  targetTableId?: string
  /** RELATION: which of the target's fields labels a linked record, in the UI and in ORDER BY. */
  labelFieldKey?: string
  /**
   * SELECT / RELATION: the field holds a list of values rather than one, stored as a JSON array.
   * One-way — a single-value field can be widened (its data migrates with it), but narrowing
   * would have to discard values with no non-arbitrary rule for which survives.
   *
   * Read through `isMultiValue`, never directly: only the types `MULTI_VALUE_BY_TYPE` allows
   * may honour it.
   */
  multiple?: boolean
}

export interface IField {
  id: string
  name: string
  key: string
  type: TFieldType
  required: boolean
  options: IFieldOptions | null
  order: number
}
