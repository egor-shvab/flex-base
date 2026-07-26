<template>
  <BaseSelect :id="id" v-model="selected" :label="field.name" :options="options" :error="error" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TRecordValue } from '#shared/types/record'
import type { IFieldInputProps } from '~/components/fields/types'

const props = defineProps<IFieldInputProps>()

const model = defineModel<TRecordValue>({ required: true })

// The blank option is always offered so a null value is never displayed as a real
// choice — a required field relies on the schema to reject it.
const options = computed(() => [
  { value: '', label: '— Select —' },
  ...(props.field.options?.choices ?? []).map((choice) => ({ value: choice, label: choice })),
])

const selected = computed({
  get: () => (typeof model.value === 'string' ? model.value : ''),
  set: (value) => (model.value = value === '' ? null : value),
})
</script>
