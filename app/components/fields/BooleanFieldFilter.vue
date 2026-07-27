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
import type { IFieldFilterProps } from '~/components/fields/types'

type TBooleanChoice = '' | 'true' | 'false'

defineProps<IFieldFilterProps>()

// `null` is "All" — a two-state control cannot express "either"
const model = defineModel<boolean | null>({ required: true })

const options: { value: TBooleanChoice; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
]

const selected = computed<TBooleanChoice>(() => {
  if (model.value === true) return 'true'
  if (model.value === false) return 'false'
  return ''
})

function onChange(choice: TBooleanChoice) {
  model.value = choice === '' ? null : choice === 'true'
}
</script>
