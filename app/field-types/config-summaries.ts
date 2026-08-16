import { markRaw, type Component } from 'vue'
import type { TFieldType } from '#shared/types/field'
import RelationFieldConfigSummary from '~/field-types/config-summaries/RelationFieldConfigSummary.vue'
import SelectFieldConfigSummary from '~/field-types/config-summaries/SelectFieldConfigSummary.vue'

/**
 * How a field's *configuration* reads beside its type — what the field manager shows so a table's
 * shape can be read without opening a dialog per row. Every entry honours
 * `IFieldConfigSummaryProps`.
 *
 * `null` means the type has nothing to configure beyond itself: a TEXT field is entirely
 * described by the word "Text". Total, so a new `FieldType` must state its position rather than
 * silently rendering nothing.
 *
 * The one control-adjacent registry with **no `MULTI_*` override table**, and deliberately so:
 * cardinality is answered for every type by `isMultiValue(field)`, so the caller renders that
 * part itself instead of two components repeating it. That is also why callers index this map
 * directly rather than through a resolver — there is no override for one to consult.
 */
export const FIELD_CONFIG_SUMMARIES: Record<TFieldType, Component | null> = {
  TEXT: null,
  NUMBER: null,
  BOOLEAN: null,
  DATE: null,
  SELECT: markRaw(SelectFieldConfigSummary),
  RELATION: markRaw(RelationFieldConfigSummary),
}
