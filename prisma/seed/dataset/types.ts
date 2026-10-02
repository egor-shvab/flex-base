import type { TBadgeColor } from '#shared/types/color'
import type { TFieldType } from '#shared/types/field'

export type TSeedValue = string | number | boolean | null | string[]

export interface ISeedField {
  name: string
  type: TFieldType
  required?: boolean
  indexed?: boolean
  choices?: { value: string; color: TBadgeColor }[]
  target?: string
  labelField?: string
  multiple?: boolean
}

export interface ISeedRecord {
  ref: string
  values: Record<string, TSeedValue>
}

export interface ISeedTable {
  key: string
  name: string
  fields: ISeedField[]
  records: ISeedRecord[]
}

export type TSeedRow = [ref: string, ...values: TSeedValue[]]

/** The length check matters: a drifted row would assign valid values to the wrong columns. */
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
