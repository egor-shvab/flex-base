<template>
  <BaseModal
    :title="mode === 'create' ? 'New record' : 'Edit record'"
    size="lg"
    @close="emit('close')"
  >
    <form :id="formId" class="record-form" novalidate @submit.prevent="submit">
      <BaseErrorBanner :message="serverError" />

      <RecordForm
        :fields="shownFields"
        :read-only-field-ids="readOnlyFieldIds"
        :record="record"
        :values="form"
        :errors="errors"
        @update="setValue"
      />
    </form>

    <template #footer>
      <BaseButton variant="secondary" :busy="isSubmitting" @click="emit('close')"
        >Cancel</BaseButton
      >
      <BaseButton type="submit" :form="formId" :loading="isSubmitting">
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
    readOnlyFieldIds?: ReadonlySet<string>
    record?: IRecord
    submitHandler: (data: TRecordData) => Promise<void>
  }>(),
  { readOnlyFieldIds: () => new Set<string>(), record: undefined },
)

const emit = defineEmits<{ saved: []; close: [] }>()

const formId = useId()

/** Only these are in the form and its payload: the server keeps every other value as stored. */
const editableFields = props.fields.filter((field) => !props.readOnlyFieldIds.has(field.id))

/** A new record holds nothing a read-only field could show, so only an edit shows them. */
const shownFields = props.record ? props.fields : editableFields

const initial: TRecordData = Object.fromEntries(
  editableFields.map((field) => [field.key, props.record?.data[field.key] ?? blankValueFor(field)]),
)

const { form, errors, serverError, isSubmitting, submit } = useForm({
  schema: buildRecordSchema(editableFields),
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
