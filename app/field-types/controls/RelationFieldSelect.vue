<template>
  <!--
    Two branches rather than one select bound to a union, because `BaseSelect` ties `multiple`
    to its model's own type on purpose (`docs/decisions.md`) — weakening that contract to
    satisfy one caller would let every other call site disagree with itself at runtime.
    `multiple` comes from field metadata and is fixed for this control's lifetime, so the
    branch never swaps the focused element out from under the user.
  -->
  <BaseSelect
    v-if="multiple"
    :id="id"
    v-model="listModel"
    :label="label"
    :options="options"
    searchable
    :load-options="search"
    :multiple="true"
    :placeholder="placeholder"
    :clearable="clearable"
    :error="error"
    empty-label="No records to link to"
  >
    <template #option-label="{ option }">
      <BaseRecordRef v-if="refOf(option.value)" v-bind="refOf(option.value)!" />
      <template v-else>{{ option.label }}</template>
    </template>
  </BaseSelect>
  <BaseSelect
    v-else
    :id="id"
    v-model="singleModel"
    :label="label"
    :options="options"
    searchable
    :load-options="search"
    :placeholder="placeholder"
    :clearable="clearable"
    :error="error"
    empty-label="No records to link to"
  >
    <template #option-label="{ option }">
      <BaseRecordRef v-if="refOf(option.value)" v-bind="refOf(option.value)!" />
      <template v-else>{{ option.label }}</template>
    </template>
  </BaseSelect>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { UNKNOWN_RECORD_LABEL } from '#shared/constants/record'
import type { IRecordRef } from '#shared/types/record'
import { formatRecordRef } from '#shared/utils/record-label'
import { useRelationsStore } from '~/stores/relations'
import type { ISelectOption } from '~/types/select'

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
 * The selection as a list, whatever the model's shape — the same normalisation `BaseSelect`
 * does internally, and what lets everything below be written once for both branches.
 */
const linkedIds = computed<string[]>(() => {
  if (Array.isArray(model.value)) return model.value

  return model.value === '' ? [] : [model.value]
})

/** Typed proxies, so each branch hands `BaseSelect` exactly the model its generic expects. */
const listModel = computed<string[]>({
  get: () => linkedIds.value,
  set: (value) => (model.value = value),
})

const singleModel = computed<string>({
  get: () => (typeof model.value === 'string' ? model.value : (model.value[0] ?? '')),
  set: (value) => (model.value = value),
})

/** How a candidate reads, for the slot below. `undefined` only for a target that is gone. */
function refOf(recordId: string): IRecordRef | undefined {
  return relations.refFor(props.fieldId, recordId)
}

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
    ...candidates.map((candidate) => ({ value: candidate.id, label: formatRecordRef(candidate) })),
    ...unlisted.map((id) => {
      const ref = refOf(id)
      // Nothing resolved: the target is gone, so there is no number to state either
      return { value: id, label: ref === undefined ? UNKNOWN_RECORD_LABEL : formatRecordRef(ref) }
    }),
  ]
})

function search(term: string, signal: AbortSignal): Promise<ISelectOption[]> {
  return relations
    .searchOptions(props.fieldId, term, signal)
    .then((rows) => rows.map((row) => ({ value: row.id, label: formatRecordRef(row) })))
}
</script>
