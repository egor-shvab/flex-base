<template>
  <div class="record-fields">
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

const emit = defineEmits<{ update: [key: string, value: TRecordValue] }>()

const formId = useId()

const controls = useFieldControls(() => props.fields, inputFor)

type TRecordControl = (typeof controls.value)[number]

function controlValue(control: TRecordControl): TFilterValue {
  return control.toControl(props.values[control.field.key] ?? null)
}

function applyValue(control: TRecordControl, model: TFilterValue) {
  emit('update', control.field.key, control.fromControl(model))
}
</script>

<style lang="scss" scoped>
.record-fields {
  @include stack;
}
</style>
