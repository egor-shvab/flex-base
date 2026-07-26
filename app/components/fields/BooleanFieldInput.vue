<template>
  <BaseCheckbox v-model="checked" :label="field.name" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TRecordValue } from '#shared/types/record'
import type { IFieldInputProps } from '~/components/fields/types'

defineProps<IFieldInputProps>()

const model = defineModel<TRecordValue>({ required: true })

const checked = computed({
  get: () => model.value === true,
  set: (value) => (model.value = value),
})
</script>
