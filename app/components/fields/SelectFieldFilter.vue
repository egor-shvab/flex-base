<template>
  <BaseSelect :id="id" v-model="model" :label="field.name" :options="options" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { IFieldFilterProps } from '~/components/fields/types'

const props = defineProps<IFieldFilterProps>()

// An empty choice is "All" — the absence of a filter, not a value
const model = defineModel<string>({ required: true })

// The choices come from the field's own metadata, so the list needs no extra request
const options = computed(() => [
  { value: '', label: 'All' },
  ...(props.field.options?.choices ?? []).map((choice) => ({ value: choice, label: choice })),
])
</script>
