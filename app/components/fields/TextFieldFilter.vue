<template>
  <BaseInput
    :id="id"
    :model-value="text"
    :label="field.name"
    placeholder="Contains…"
    @update:model-value="onInput"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { debounce } from '~/utils/debounce'
import type { IRecordFilter } from '#shared/types/filter'
import type { IFieldFilterProps } from '~/components/fields/types'

const props = defineProps<IFieldFilterProps>()

const emit = defineEmits<{ 'update:conditions': [conditions: IRecordFilter[]] }>()

// Local state so typing stays responsive while the emit is debounced
const text = ref('')

const activeValue = computed(() => {
  const condition = props.conditions[0]
  return typeof condition?.value === 'string' ? condition.value : ''
})

// The filter also changes from outside (clear all, a shared URL, the back button)
watch(activeValue, (value) => (text.value = value), { immediate: true })

const emitConditions = debounce(() => {
  const value = text.value.trim()
  emit('update:conditions', value === '' ? [] : [{ key: props.field.key, op: 'contains', value }])
})

// BaseInput's model is optional, so a cleared input arrives as undefined
function onInput(value: string | undefined) {
  text.value = value ?? ''
  emitConditions()
}
</script>
