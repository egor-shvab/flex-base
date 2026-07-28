<template>
  <BaseInput :id="id" v-model="date" type="date" :label="label ?? field.name" :error="error" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TRecordValue } from '#shared/types/record'
import type { IFieldInputProps } from '~/components/fields/types'

defineProps<IFieldInputProps>()

const model = defineModel<TRecordValue>({ required: true })

// A date input already speaks YYYY-MM-DD, which is exactly how dates are stored
const date = computed({
  get: () => (typeof model.value === 'string' ? model.value : ''),
  set: (value) => (model.value = value === '' ? null : value),
})
</script>
