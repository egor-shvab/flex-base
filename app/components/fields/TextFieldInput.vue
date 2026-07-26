<template>
  <BaseInput :id="id" v-model.trim="text" :label="field.name" :error="error" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TRecordValue } from '#shared/types/record'
import type { IFieldInputProps } from '~/components/fields/types'

defineProps<IFieldInputProps>()

const model = defineModel<TRecordValue>({ required: true })

// A blank input means "no value", never an empty string
const text = computed({
  get: () => (typeof model.value === 'string' ? model.value : ''),
  set: (value) => (model.value = value === '' ? null : value),
})
</script>
