<template>
  <BaseSelect :id="id" v-model="model" :label="label" :options="options" :error="error" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { UNKNOWN_RECORD_LABEL } from '#shared/constants/record'
import { useRelationsStore } from '~/stores/relations'

/**
 * The one control both relation registries name, for editing a record and for filtering one.
 * Every other type's entry is pure data, because a `Base*` control needs nothing but the
 * field; a relation's candidates are records of another table, which no synchronous
 * `props(field)` factory can produce — so the fetching lives in the store this reads, and
 * the registry entry stays an ordinary `IFieldControl`.
 */
const props = withDefaults(
  defineProps<{
    id: string
    label: string
    fieldId: string
    /** What "no link" reads as — "— Select —" when editing, "All" when filtering. */
    blankLabel: string
    error?: string
  }>(),
  { error: undefined },
)

const model = defineModel<string>({ required: true })

const relations = useRelationsStore()

const options = computed(() => {
  const candidates = relations.optionsFor(props.fieldId)
  const linked = model.value

  // A link the candidate list does not offer — a target beyond the listed page, or one since
  // deleted — is still shown, or opening the form would silently drop it on save
  const unlisted = linked !== '' && !candidates.some((candidate) => candidate.id === linked)

  return [
    { value: '', label: props.blankLabel },
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
</script>
