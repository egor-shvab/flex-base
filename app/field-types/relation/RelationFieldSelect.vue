<template>
  <!--
    Two branches rather than one select bound to a union, because `BaseSelect` ties `multiple`
    to its model's own type on purpose (`docs/decisions.md`) — weakening that contract to
    satisfy one caller would let every other call site disagree with itself at runtime.
    `multiple` comes from field metadata and is fixed for this control's lifetime, so the
    branch never swaps the focused element out from under the user.
  -->
  <BaseSelect v-if="multiple" v-bind="selectProps" v-model="listModel" :multiple="true">
    <template #option-label="{ option }">
      <RelationOptionLabel :field-id="fieldId" :option="option" />
    </template>
  </BaseSelect>
  <BaseSelect v-else v-bind="selectProps" v-model="singleModel">
    <template #option-label="{ option }">
      <RelationOptionLabel :field-id="fieldId" :option="option" />
    </template>
  </BaseSelect>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { UNKNOWN_RECORD_LABEL } from '#shared/constants/record'
import type { ILinkedRecord } from '#shared/types/record'
import { formatLinkedRecord } from '#shared/utils/record-label'
// Explicit, because `field-types/` sits outside `~/components` on purpose — nothing here is
// globally registered, so an unimported tag would silently render nothing
import RelationOptionLabel from '~/field-types/relation/RelationOptionLabel.vue'
import { useRelationsStore } from '~/stores/relations'
import type { ISelectOption } from '~/types/select'
import { toValueList } from '~/utils/value-shape'

/**
 * The one control both relation registries name, for editing a record and for filtering one.
 * Every other type's entry is pure data, because a `Base*` control needs nothing but the
 * field; a relation's candidates are records of another table, which no synchronous
 * `props(field)` factory can produce — so the fetching lives in the store this reads, and
 * the registry entry stays an ordinary `IFieldControl`.
 *
 * It is now also the only control that fetches on *user input*: the seed list below is
 * capped, so anything past it is reached by searching the target table server-side.
 * `searchable` is therefore unconditional here rather than counted like a SELECT's choices —
 * the cap is on the *seed*, so the option count says nothing about how many records exist.
 */
const props = withDefaults(
  defineProps<{
    id: string
    label: string
    fieldId: string
    /** Several links at once — a multi-value relation field, and its list-shaped filter. */
    multiple?: boolean
    /** What "no link" reads as — "— Select —" when editing, "All" when filtering. */
    placeholder?: string
    clearable?: boolean
    error?: string
  }>(),
  { multiple: false, placeholder: undefined, clearable: false, error: undefined },
)

const model = defineModel<string | string[]>({ required: true })

const relations = useRelationsStore()

/**
 * The stored value of a relation field as the list it may hold — which is `toValueList`'s own
 * question, so it is asked there rather than restated here, and everything below is written once
 * for both branches. `BaseSelect` normalises its model too, but that is a control's own business
 * and stays in the control (`docs/decisions.md`).
 */
const linkedIds = computed<string[]>(() => toValueList(model.value))

/** Typed proxies, so each branch hands `BaseSelect` exactly the model its generic expects. */
const listModel = computed<string[]>({
  get: () => linkedIds.value,
  set: (value) => (model.value = value),
})

const singleModel = computed<string>({
  get: () => (typeof model.value === 'string' ? model.value : (model.value[0] ?? '')),
  set: (value) => (model.value = value),
})

/** How a candidate reads, for the options below. `undefined` only for a target that is gone. */
function linkedRecordOf(recordId: string): ILinkedRecord | undefined {
  return relations.linkedRecordFor(props.fieldId, recordId)
}

/**
 * Everything the two branches agree on. They differ by their model's **type** and nothing else —
 * `multiple` is tied to it on purpose (`docs/decisions.md`), which is why the branch exists — so
 * the rest is bound once here rather than written out twice.
 */
const selectProps = computed(() => ({
  id: props.id,
  label: props.label,
  options: options.value,
  // The seed is capped, so anything past it is reached by searching the target table, whatever
  // the option count says — unconditional here rather than counted like a SELECT's choices
  searchable: true,
  loadOptions: search,
  placeholder: props.placeholder,
  clearable: props.clearable,
  error: props.error,
  emptyLabel: 'No records to link to',
}))

/**
 * The seed `BaseSelect` shows before anything is typed. Still capped by the endpoint, which
 * is exactly why the search below exists.
 *
 * Every option's `label` is the **flat** form of its ref. That is what `BaseSelect` shows in
 * the trigger, matches on type-ahead, filters locally, and remembers in its `seen` map — none
 * of which need to know what a record reference is. The slot restyles the same text; it never
 * adds to it, so the two can never disagree.
 */
const options = computed<ISelectOption[]>(() => {
  const candidates = relations.optionsFor(props.fieldId)
  const offered = new Set(candidates.map((candidate) => candidate.id))

  // A link the candidate list does not offer — a target beyond the listed page, one reached
  // through a search, or one since deleted — is still shown, or opening the form would
  // silently drop it on save. It is also what keeps the trigger labelled while a search has
  // replaced the visible list with rows that do not include it. Every link is checked, not
  // just the first: dropping one of several is as lossy as dropping the only one. It is also
  // why `BaseSelect`'s own `{ value, label: value }` fallback is unreachable from here.
  const unlisted = linkedIds.value.filter((id) => !offered.has(id))

  return [
    ...candidates.map((candidate) => ({
      value: candidate.id,
      label: formatLinkedRecord(candidate),
    })),
    ...unlisted.map((id) => {
      const ref = linkedRecordOf(id)
      // Nothing resolved: the target is gone, so there is no number to state either
      return {
        value: id,
        label: ref === undefined ? UNKNOWN_RECORD_LABEL : formatLinkedRecord(ref),
      }
    }),
  ]
})

function search(term: string, signal: AbortSignal): Promise<ISelectOption[]> {
  return relations
    .searchOptions(props.fieldId, term, signal)
    .then((rows) => rows.map((row) => ({ value: row.id, label: formatLinkedRecord(row) })))
}
</script>
