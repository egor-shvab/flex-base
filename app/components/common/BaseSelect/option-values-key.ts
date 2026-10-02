import type { ISelectOption } from '~/types/select'

/**
 * Keys a list by its values, so watchers fire on a changed list rather than a new array.
 * `JSON.stringify`, not a `join`: a SELECT choice may contain any separator.
 */
export function optionValuesKey(options: ISelectOption[]): string {
  return JSON.stringify(options.map((option) => option.value))
}
