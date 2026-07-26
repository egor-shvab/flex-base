<template>
  <BaseSelect
    :id="id"
    :model-value="selected"
    :label="field.name"
    :options="options"
    @update:model-value="onChange"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { IRecordFilter } from '#shared/types/filter'
import type { IFieldFilterProps } from '~/components/fields/types'

const props = defineProps<IFieldFilterProps>()

const emit = defineEmits<{ 'update:conditions': [conditions: IRecordFilter[]] }>()

// The choices come from the field's own metadata, so the list needs no extra request
const options = computed(() => [
  { value: '', label: 'All' },
  ...(props.field.options?.choices ?? []).map((choice) => ({ value: choice, label: choice })),
])

const selected = computed(() => {
  const value = props.conditions[0]?.value
  return typeof value === 'string' ? value : ''
})

function onChange(choice: string) {
  emit(
    'update:conditions',
    choice === '' ? [] : [{ key: props.field.key, op: 'eq', value: choice }],
  )
}
</script>
