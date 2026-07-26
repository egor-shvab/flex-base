import type { IField } from '#shared/types/field'
import type { TRecordValue } from '#shared/types/record'

/** Uniform contract every field input component honours (plus `v-model` of TRecordValue). */
export interface IFieldInputProps {
  id: string
  field: IField
  error?: string
}

/** Uniform contract every field cell component honours. Null values never reach a cell. */
export interface IFieldCellProps {
  field: IField
  value: TRecordValue
}
