<template>
  <div class="dynamic-form">
    <component
      :is="control.component"
      v-for="control in controls"
      :id="`${formId}-${control.field.key}`"
      :key="control.field.key"
      v-bind="control.props"
      :error="errors[control.field.key]"
      :model-value="controlValue(control.field)"
      @update:model-value="applyValue(control.field, $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
import type { IField } from '#shared/types/field'
import type { TFilterValue } from '#shared/types/filter'
import type { TRecordData, TRecordValue } from '#shared/types/record'
import { inputFor } from '~/field-types/inputs'

const props = defineProps<{
  fields: IField[]
  values: TRecordData
  errors: Partial<Record<string, string>>
}>()

// Values flow down as props and changes flow back up as events — the form object
// belongs to the parent's `useForm`, so this component never mutates it.
const emit = defineEmits<{ update: [key: string, value: TRecordValue] }>()

const formId = useId()

/** Resolved once per field rather than per render, since `props` is a factory. */
const controls = computed(() =>
  props.fields.map((field) => {
    const input = inputFor(field)

    return { field, component: input.component, props: input.props(field) }
  }),
)

/** The record's value as the control's own model. */
function controlValue(field: IField): TFilterValue {
  return inputFor(field).toControl(props.values[field.key] ?? null)
}

/** The inverse: what the control just emitted, back as a record value. */
function applyValue(field: IField, model: TFilterValue) {
  emit('update', field.key, inputFor(field).fromControl(model))
}
</script>

<style lang="scss" scoped>
.dynamic-form {
  @include stack;
}
</style>
