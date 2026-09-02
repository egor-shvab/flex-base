import type { TBadgeColor } from '#shared/types/color'
import type { TFieldType } from '#shared/types/field'

/**
 * The shapes the dataset is written in. Deliberately **not** `IField` / `IRecord`: those carry
 * ids and keys, which do not exist until the writer has derived them. What a dataset module
 * states is what a person would type into the app — names, choices, values — and nothing else.
 */

/** A value as the dataset writes it. A RELATION value is a local ref, or a list of them. */
export type TSeedValue = string | number | boolean | null | string[]

export interface ISeedField {
  name: string
  type: TFieldType
  required?: boolean
  indexed?: boolean
  /** SELECT: its choices, in the order the picker shows them. */
  choices?: { value: string; color: TBadgeColor }[]
  /** RELATION: the local `key` of the table it points at — resolved to a cuid by the writer. */
  target?: string
  /** RELATION: the **name** of the target's field that labels a link. */
  labelField?: string
  /** SELECT / RELATION: whether the field holds a list. */
  multiple?: boolean
}

export interface ISeedRecord {
  /** Local identity, unique across the whole dataset — what a relation value names. */
  ref: string
  /** Keyed by field **name**; the writer maps each to the key `buildFieldKey` derives. */
  values: Record<string, TSeedValue>
}

export interface ISeedTable {
  /** Local identity, what a RELATION field's `target` names. */
  key: string
  name: string
  fields: ISeedField[]
  records: ISeedRecord[]
}

/** A record as a dataset module writes one: its ref, then one value per field, in field order. */
export type TSeedRow = [ref: string, ...values: TSeedValue[]]

/**
 * Zips positional rows onto field names.
 *
 * Rows are written as tuples rather than objects because a table of two hundred records reads as
 * a table only when each row is one line. The length check is what keeps that safe: a row that
 * drifts out of step with the fields above it would otherwise silently assign every value to the
 * wrong column, and every one of them would still be a valid value of *some* type.
 */
export function rowsFrom(fields: ISeedField[], rows: TSeedRow[]): ISeedRecord[] {
  return rows.map(([ref, ...values]) => {
    if (values.length !== fields.length) {
      throw new Error(`Seed row "${ref}" has ${values.length} values for ${fields.length} fields`)
    }

    return {
      ref,
      values: Object.fromEntries(fields.map((field, index) => [field.name, values[index] ?? null])),
    }
  })
}
