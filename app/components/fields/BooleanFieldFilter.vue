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

type TBooleanChoice = '' | 'true' | 'false'

const props = defineProps<IFieldFilterProps>()

const emit = defineEmits<{ 'update:conditions': [conditions: IRecordFilter[]] }>()

const options: { value: TBooleanChoice; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
]

const selected = computed<TBooleanChoice>(() => {
  const condition = props.conditions[0]
  if (condition?.value === true) return 'true'
  if (condition?.value === false) return 'false'
  return ''
})

function onChange(choice: TBooleanChoice) {
  // "All" is the absence of a condition, not a third value
  emit(
    'update:conditions',
    choice === '' ? [] : [{ key: props.field.key, op: 'eq', value: choice === 'true' }],
  )
}
</script>
