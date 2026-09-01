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
import type { ILinkedRecord, IRecordOption } from '#shared/types/record'
import { formatLinkedRecord } from '#shared/utils/record-label'
// Explicit: `field-types/` sits outside `~/components`, so nothing here is auto-registered
import RelationOptionLabel from '~/field-types/relation/RelationOptionLabel.vue'
import { useRelationsStore } from '~/stores/relations'
import type { ISelectOption } from '~/types/select'
import { toValueList } from '~/utils/value-shape'

/**
 * The one control both relation registries name, for editing and for filtering. Every other
 * type's entry is pure data; a relation's candidates are records of another table, which no
 * synchronous `props(field)` factory can produce — so the fetching lives in the store this
 * reads and the registry entry stays an ordinary `IFieldControl`.
 *
 * It is also the only control that fetches on *user input*: the seed list is capped, so
 * anything past it is reached by searching the target table server-side. `searchable` is
 * therefore unconditional — the cap is on the seed, so the option count says nothing.
 */
const props = withDefaults(
  defineProps<{
    id: string
    label: string
    fieldId: string
    /** Several links at once — a multi-value relation field, and its list-shaped filter. */
    multiple?: boolean
    /**
     * What this control's model holds: the target's **id**, which is what a record stores, or
     * its **number**, which is what a filter puts in the URL. Only the model's currency changes
     * — everything below still reads a linked record the way the store keys them.
     */
    valueBy?: 'id' | 'number'
    /** What "no link" reads as — "— Select —" when editing, "All" when filtering. */
    placeholder?: string
    clearable?: boolean
    error?: string
  }>(),
  { multiple: false, valueBy: 'id', placeholder: undefined, clearable: false, error: undefined },
)

const model = defineModel<string | string[]>({ required: true })

const relations = useRelationsStore()

/**
 * The stored value as the list it may hold — `toValueList`'s own question, so everything below
 * is written once for both branches. `BaseSelect` normalises its model too, but that stays a
 * control's own business (`docs/decisions.md`).
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

/** What a candidate is worth to this control's model — the seam `valueBy` turns on. */
function valueOf(candidate: IRecordOption): string {
  return props.valueBy === 'number' ? String(candidate.number) : candidate.id
}

/**
 * How a model value reads. The store keys linked records by id, so a number-valued model looks
 * up through the by-number index. `undefined` only for a target that is gone — or, for a
 * number, one outside the candidates seen so far.
 */
function linkedRecordOf(value: string): ILinkedRecord | undefined {
  return props.valueBy === 'number'
    ? relations.linkedRecordByNumber(props.fieldId, Number(value))
    : relations.linkedRecordFor(props.fieldId, value)
}

/**
 * Everything the two branches agree on. They differ by their model's **type** alone, which is
 * why the branch exists at all (`docs/decisions.md`).
 */
const selectProps = computed(() => ({
  id: props.id,
  label: props.label,
  options: options.value,
  // The seed is capped, so anything past it is reached by searching — unconditional here
  // rather than counted like a SELECT's choices
  searchable: true,
  loadOptions: search,
  placeholder: props.placeholder,
  clearable: props.clearable,
  error: props.error,
  emptyLabel: 'No records to link to',
}))

/**
 * The seed `BaseSelect` shows before anything is typed, capped by the endpoint — which is why
 * the search exists.
 *
 * Every option's `label` is the **flat** form of its ref: what `BaseSelect` shows in the
 * trigger, matches on type-ahead, filters locally and remembers in `seen`, none of which need
 * to know what a record reference is. The slot restyles the same text, never adds to it.
 */
const options = computed<ISelectOption[]>(() => {
  const candidates = relations.optionsFor(props.fieldId)
  const offered = new Set(candidates.map(valueOf))

  // A link the candidate list does not offer — beyond the listed page, reached by a search, or
  // since deleted — is still shown, or opening the form would silently drop it on save. It also
  // keeps the trigger labelled while a search has replaced the visible list. Every link is
  // checked, not just the first, which is why `BaseSelect`'s own fallback is unreachable here.
  const unlisted = linkedIds.value.filter((value) => !offered.has(value))

  return [
    ...candidates.map((candidate) => ({
      value: valueOf(candidate),
      label: formatLinkedRecord(candidate),
    })),
    ...unlisted.map((value) => {
      const ref = linkedRecordOf(value)
      // Nothing resolved: the target is gone, so there is no number to state either
      return {
        value,
        label: ref === undefined ? UNKNOWN_RECORD_LABEL : formatLinkedRecord(ref),
      }
    }),
  ]
})

function search(term: string, signal: AbortSignal): Promise<ISelectOption[]> {
  return relations
    .searchOptions(props.fieldId, term, signal)
    .then((rows) => rows.map((row) => ({ value: valueOf(row), label: formatLinkedRecord(row) })))
}
</script>
