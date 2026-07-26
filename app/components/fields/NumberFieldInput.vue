<template>
  <BaseInput :id="id" v-model="text" type="number" :label="field.name" :error="error" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TRecordValue } from '#shared/types/record'
import type { IFieldInputProps } from '~/components/fields/types'

defineProps<IFieldInputProps>()

const model = defineModel<TRecordValue>({ required: true })

const text = computed({
  get: () => (model.value === null ? '' : String(model.value)),
  set: (value) => {
    const trimmed = value.trim()
    if (trimmed === '') {
      model.value = null
      return
    }
    // Unparseable input is kept as-is so the schema reports "Enter a number"
    const parsed = Number(trimmed)
    model.value = Number.isNaN(parsed) ? trimmed : parsed
  },
})
</script>
