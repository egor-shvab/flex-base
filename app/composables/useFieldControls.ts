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
 * rather than beside those two, so this sentence is the only thing scoping it (`docs/decisions.md`).
 *
 * `props` on a registry entry is a **factory**, and calling it is the point: this resolves inside a
 * `computed`, so each control's props object is built once per change of the field list rather than
 * on every render. Both renderers used to assert that in a comment of their own; it is held here
 * instead.
 *
 * **Generic on the control, which is what preserves each caller's adapter arity.** `inputFor`
 * returns `TRecordFieldControl` — `Required<IFieldControl<TRecordValue>>` — so `RecordForm` gets
 * `toControl` / `fromControl` back as **required** and never branches on them, which is the
 * guarantee `architecture.md` §3 records. `filterFor` returns them optional, so the drawer still
 * branches. Defaulting a missing adapter to identity here would collapse that difference and turn a
 * type-level promise into a runtime accident.
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
