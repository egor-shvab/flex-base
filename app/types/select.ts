import type { TBadgeColor } from '#shared/types/color'

/**
 * One option a `BaseSelect` offers. Client-only — the server speaks `IRecordOption` and the
 * field metadata speaks `IFieldChoice`; this is what both are mapped to at the call site.
 *
 * `color` is what finally puts a SELECT choice's hue in the picker rather than only in a
 * table cell: an `<option>` fill is not styleable, an option *row* is.
 */
export interface ISelectOption<TValue extends string = string> {
  value: TValue
  label: string
  color?: TBadgeColor
  disabled?: boolean
}

/**
 * How a select fetches its own options. Presence of one of these is what puts a `BaseSelect`
 * into async mode; the `signal` is aborted when a newer term supersedes this request.
 */
export type TLoadSelectOptions<TValue extends string = string> = (
  term: string,
  signal: AbortSignal,
) => Promise<ISelectOption<TValue>[]>
