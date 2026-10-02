<template>
  <!--
    Two branches because `BaseSelect` ties `multiple` to its model's type on purpose; `multiple` is
    fixed for this control's lifetime, so the branch never swaps the focused element.
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

const props = withDefaults(
  defineProps<{
    id: string
    label: string
    fieldId: string
    multiple?: boolean
    valueBy?: 'id' | 'number'
    placeholder?: string
    clearable?: boolean
    error?: string
  }>(),
  { multiple: false, valueBy: 'id', placeholder: undefined, clearable: false, error: undefined },
)

const model = defineModel<string | string[]>({ required: true })

const relations = useRelationsStore()

const linkedIds = computed<string[]>(() => toValueList(model.value))

const listModel = computed<string[]>({
  get: () => linkedIds.value,
  set: (value) => (model.value = value),
})

const singleModel = computed<string>({
  get: () => (typeof model.value === 'string' ? model.value : (model.value[0] ?? '')),
  set: (value) => (model.value = value),
})

function valueOf(candidate: IRecordOption): string {
  return props.valueBy === 'number' ? String(candidate.number) : candidate.id
}

function linkedRecordOf(value: string): ILinkedRecord | undefined {
  return props.valueBy === 'number'
    ? relations.linkedRecordByNumber(props.fieldId, Number(value))
    : relations.linkedRecordFor(props.fieldId, value)
}

const selectProps = computed(() => ({
  id: props.id,
  label: props.label,
  options: options.value,
  searchable: true,
  loadOptions: search,
  placeholder: props.placeholder,
  clearable: props.clearable,
  error: props.error,
  emptyLabel: 'No records to link to',
}))

const options = computed<ISelectOption[]>(() => {
  const candidates = relations.optionsFor(props.fieldId)
  const offered = new Set(candidates.map(valueOf))

  // An unlisted link is still shown, or saving the form would silently drop it. Every link is
  // checked, which is why `BaseSelect`'s own single fallback is unreachable here
  const unlisted = linkedIds.value.filter((value) => !offered.has(value))

  return [
    ...candidates.map((candidate) => ({
      value: valueOf(candidate),
      label: formatLinkedRecord(candidate),
    })),
    ...unlisted.map((value) => {
      const ref = linkedRecordOf(value)
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
