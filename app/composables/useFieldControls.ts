import { computed, type ComputedRef } from 'vue'
import type { IField } from '#shared/types/field'
import type { TFilterValue } from '#shared/types/filter'
import type { IFieldControl } from '~/field-types/types'

/** One field's control with its props already built — what a renderer binds per row. */
export type TResolvedFieldControl<TControl> = Omit<TControl, 'props'> & {
  field: IField
  props: Record<string, unknown>
}

/**
 * Each field's control, resolved through the registry once per field.
 *
 * **For the two metadata renderers, not general purpose** — `RecordForm` over `inputFor` and
 * `RecordsFilterPanel` over `filterFor` are the whole consumer set. It sits in `app/composables/`
 * rather than beside them, so this sentence is the only thing scoping it (`docs/decisions.md`).
 *
 * `props` on a registry entry is a **factory**: resolving inside a `computed` builds each props
 * object once per change of the field list rather than on every render.
 *
 * **Generic on the control, which preserves each caller's adapter arity.** `inputFor` returns
 * `TRecordFieldControl`, so `RecordForm` gets `toControl` / `fromControl` back as **required**
 * and never branches (`architecture.md` §3); `filterFor` returns them optional, so the drawer
 * does. Defaulting a missing adapter to identity would collapse that into a runtime accident.
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
