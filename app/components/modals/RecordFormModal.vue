<template>
  <BaseModal :title="mode === 'create' ? 'New record' : 'Edit record'" @close="emit('close')">
    <form class="record-form" novalidate @submit.prevent="submit">
      <DynamicForm :fields="fields" :values="form" :errors="errors" @update="setValue" />

      <p v-if="serverError" role="alert" class="record-form__server-error">{{ serverError }}</p>

      <BaseButton type="submit" :disabled="pending">
        {{ mode === 'create' ? 'Create record' : 'Save' }}
      </BaseButton>
    </form>
  </BaseModal>
</template>

<script setup lang="ts">
import { useForm } from '~/composables/useForm'
import type { IField } from '#shared/types/field'
import type { IRecord, TRecordData, TRecordValue } from '#shared/types/record'
import { blankValueFor, buildRecordSchema } from '#shared/validation/record'

const props = withDefaults(
  defineProps<{
    mode: 'create' | 'edit'
    fields: IField[]
    record?: IRecord
    submitHandler: (data: TRecordData) => Promise<void>
  }>(),
  { record: undefined },
)

const emit = defineEmits<{ saved: []; close: [] }>()

// Both the initial values and the validation schema come straight from field metadata
const initial: TRecordData = Object.fromEntries(
  props.fields.map((field) => [field.key, props.record?.data[field.key] ?? blankValueFor(field)]),
)

const { form, errors, serverError, pending, submit } = useForm({
  schema: buildRecordSchema(props.fields),
  initial,
  onSubmit: async (values) => {
    await props.submitHandler(values)
    emit('saved')
  },
})

function setValue(key: string, value: TRecordValue) {
  form[key] = value
}
</script>

<style lang="scss" scoped>
.record-form {
  @include stack;

  &__server-error {
    @include error-banner;
  }
}
</style>
