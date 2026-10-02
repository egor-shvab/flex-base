<template>
  <BaseModal
    :title="mode === 'create' ? 'New record' : 'Edit record'"
    size="lg"
    @close="emit('close')"
  >
    <form :id="formId" class="record-form" novalidate @submit.prevent="submit">
      <BaseErrorBanner :message="serverError" />

      <RecordForm :fields="fields" :values="form" :errors="errors" @update="setValue" />
    </form>

    <template #footer>
      <BaseButton variant="secondary" :disabled="pending" @click="emit('close')">Cancel</BaseButton>
      <BaseButton type="submit" :form="formId" :loading="pending">
        {{ mode === 'create' ? 'Create record' : 'Save' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { useId } from 'vue'
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

const formId = useId()

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
}
</style>
