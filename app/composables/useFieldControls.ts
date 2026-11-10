import { computed, type ComputedRef } from 'vue'
import type { IField } from '#shared/types/field'
import type { TFilterValue } from '#shared/types/filter'
import type { IFieldControl } from '~/field-types/types'

export type TResolvedFieldControl<TControl> = Omit<TControl, 'props'> & {
  field: IField
  props: Record<string, unknown>
}

/**
 * Each field's control, resolved once per field — for `RecordForm` and `RecordsFilterPanel` only.
 * `props` is a factory, so resolving inside a `computed` builds it once per field-list change.
 */
export function useFieldControls<TControl extends IFieldControl<TFilterValue>>(
  fields: () => IField[],
  resolve: (field: IField) => TControl,
): ComputedRef<TResolvedFieldControl<TControl>[]> {
  return computed(() =>
    fields().map((field) => {
      const { props, ...rest } = resolve(field)

      return { ...rest, field, props: props(field) }
    }),
  )
}
