import type { TBadgeColor } from '#shared/types/color'

export interface ISelectOption<TValue extends string = string> {
  value: TValue
  label: string
  color?: TBadgeColor
  disabled?: boolean
}

export type TLoadSelectOptions<TValue extends string = string> = (
  term: string,
  signal: AbortSignal,
) => Promise<ISelectOption<TValue>[]>
