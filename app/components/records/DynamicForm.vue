<template>
  <div class="dynamic-form">
    <component
      :is="control.component"
      v-for="control in controls"
      :id="`${formId}-${control.field.key}`"
      :key="control.field.key"
      v-bind="control.props"
      :error="errors[control.field.key]"
      :model-value="controlValue(control)"
      @update:model-value="applyValue(control, $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { useId } from 'vue'
import type { IField } from '#shared/types/field'
import type { TFilterValue } from '#shared/types/filter'
import type { TRecordData, TRecordValue } from '#shared/types/record'
import { useFieldControls } from '~/composables/useFieldControls'
import { inputFor } from '~/field-types/registry'

const props = defineProps<{
  fields: IField[]
  values: TRecordData
  errors: Partial<Record<string, string>>
}>()

// Values flow down as props and changes flow back up as events — the form object
// belongs to the parent's `useForm`, so this component never mutates it.
const emit = defineEmits<{ update: [key: string, value: TRecordValue] }>()

const formId = useId()

/** A record input always adapts, so both adapters are required here and nothing branches. */
const controls = useFieldControls(() => props.fields, inputFor)

type TRecordControl = (typeof controls.value)[number]

/** The record's value as the control's own model. */
function controlValue(control: TRecordControl): TFilterValue {
  return control.toControl(props.values[control.field.key] ?? null)
}

/** The inverse: what the control just emitted, back as a record value. */
function applyValue(control: TRecordControl, model: TFilterValue) {
  emit('update', control.field.key, control.fromControl(model))
}
</script>

<style lang="scss" scoped>
.dynamic-form {
  @include stack;
}
</style>
