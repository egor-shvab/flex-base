<template>
  <div class="dynamic-form">
    <component
      :is="FIELD_COMPONENTS[field.type].input"
      v-for="field in fields"
      :id="`${formId}-${field.key}`"
      :key="field.key"
      :field="field"
      :error="errors[field.key]"
      :model-value="values[field.key] ?? null"
      @update:model-value="(value: TRecordValue) => emit('update', field.key, value)"
    />
  </div>
</template>

<script setup lang="ts">
import { useId } from 'vue'
import type { IField } from '#shared/types/field'
import type { TRecordData, TRecordValue } from '#shared/types/record'
import { FIELD_COMPONENTS } from '~/components/fields/registry'

defineProps<{
  fields: IField[]
  values: TRecordData
  errors: Partial<Record<string, string>>
}>()

// Values flow down as props and changes flow back up as events — the form object
// belongs to the parent's `useForm`, so this component never mutates it.
const emit = defineEmits<{ update: [key: string, value: TRecordValue] }>()

const formId = useId()
</script>

<style lang="scss" scoped>
.dynamic-form {
  display: flex;
  flex-direction: column;
  gap: rem(16);
}
</style>
