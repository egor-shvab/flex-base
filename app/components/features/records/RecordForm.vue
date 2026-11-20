<template>
  <div class="record-fields">
    <template v-for="row in rows" :key="row.field.key">
      <BaseField
        v-if="row.control === null"
        :id="`${formId}-${row.field.key}`"
        :label="row.field.name"
        hint="Read only"
      >
        <div class="record-fields__value">
          <RecordFieldValue v-if="record" :record="record" :column="row.field" />
        </div>
      </BaseField>
      <component
        :is="row.control.component"
        v-else
        :id="`${formId}-${row.field.key}`"
        v-bind="row.control.props"
        :error="errors[row.field.key]"
        :model-value="controlValue(row.control)"
        @update:model-value="applyValue(row.control, $event)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
import type { IField } from '#shared/types/field'
import type { TFilterValue } from '#shared/types/filter'
import type { IRecord, TRecordData, TRecordValue } from '#shared/types/record'
import { useFieldControls } from '~/composables/useFieldControls'
import { inputFor } from '~/field-types/registry'

const props = withDefaults(
  defineProps<{
    fields: IField[]
    values: TRecordData
    errors: Partial<Record<string, string>>
    /** Shown as the record holds them, never as a control: the caller may not write them. */
    readOnlyFieldIds?: ReadonlySet<string>
    record?: IRecord
  }>(),
  { readOnlyFieldIds: () => new Set<string>(), record: undefined },
)

const emit = defineEmits<{ update: [key: string, value: TRecordValue] }>()

const formId = useId()

const controls = useFieldControls(
  () => props.fields.filter((field) => !props.readOnlyFieldIds.has(field.id)),
  inputFor,
)

type TRecordControl = (typeof controls.value)[number]

/** In the fields' order, a read-only field in its place among the controls. */
const rows = computed(() => {
  const controlByKey = new Map(controls.value.map((control) => [control.field.key, control]))

  return props.fields.map((field) => ({ field, control: controlByKey.get(field.key) ?? null }))
})

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

  &__value {
    display: flex;
    align-items: center;
    min-height: var(--control-height);
    font-size: var(--font-size-md);
  }
}
</style>
