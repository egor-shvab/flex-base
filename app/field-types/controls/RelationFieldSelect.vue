<template>
  <BaseSelect
    :id="id"
    v-model="model"
    :label="label"
    :options="options"
    searchable
    :load-options="search"
    :placeholder="placeholder"
    :clearable="clearable"
    :error="error"
    empty-label="No records to link to"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { UNKNOWN_RECORD_LABEL } from '#shared/constants/record'
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
    /** What "no link" reads as — "— Select —" when editing, "All" when filtering. */
    placeholder?: string
    clearable?: boolean
    error?: string
  }>(),
  { placeholder: undefined, clearable: false, error: undefined },
)

const model = defineModel<string>({ required: true })

const relations = useRelationsStore()

/**
 * The seed `BaseSelect` shows before anything is typed. Still capped by the endpoint, which
 * is exactly why the search below exists.
 */
const options = computed<ISelectOption[]>(() => {
  const candidates = relations.optionsFor(props.fieldId)
  const linked = model.value

  // A link the candidate list does not offer — a target beyond the listed page, one reached
  // through a search, or one since deleted — is still shown, or opening the form would
  // silently drop it on save. It is also what keeps the trigger labelled while a search has
  // replaced the visible list with rows that do not include it.
  const unlisted = linked !== '' && !candidates.some((candidate) => candidate.id === linked)

  return [
    ...candidates.map((candidate) => ({ value: candidate.id, label: candidate.label })),
    ...(unlisted
      ? [
          {
            value: linked,
            label: relations.labelFor(props.fieldId, linked) ?? UNKNOWN_RECORD_LABEL,
          },
        ]
      : []),
  ]
})

function search(term: string, signal: AbortSignal): Promise<ISelectOption[]> {
  return relations
    .searchOptions(props.fieldId, term, signal)
    .then((rows) => rows.map((row) => ({ value: row.id, label: row.label })))
}
</script>
