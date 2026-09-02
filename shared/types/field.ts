import type { FIELD_TYPES } from '#shared/field-types/registry'
import type { TBadgeColor } from '#shared/types/color'

export type TFieldType = (typeof FIELD_TYPES)[number]

/**
 * One SELECT option. `value` is both the label and the identity: a record stores this string,
 * so renaming a choice orphans the records holding the old one (`docs/decisions.md`).
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
   * SELECT / RELATION: the field holds a list, stored as a JSON array. One-way — widening
   * migrates the data, where narrowing would discard values with no rule for which survives.
   * Read through `isMultiValue`, never directly.
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
  /**
   * Whether this field carries indexes for sorting and filtering. Opt-in per field, since an
   * index slows every write; which indexes it means is the type's business (`IFieldSqlRules`).
   */
  indexed: boolean
}
