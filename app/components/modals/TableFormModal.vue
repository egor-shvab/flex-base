<template>
  <BaseModal :title="mode === 'create' ? 'New table' : 'Rename table'" @close="emit('close')">
    <form class="table-form" novalidate @submit.prevent="submit">
      <!-- A form-level error is a banner, as in every other form — routing it into the field's
           inline message attributed a duplicate-name 409 to the input and skipped `role="alert"` -->
      <p v-if="serverError" class="table-form__server-error" role="alert">{{ serverError }}</p>

      <BaseInput
        :id="inputId"
        v-model.trim="form.name"
        label="Table name"
        placeholder="e.g. Customers"
        autofocus
        :error="errors.name"
      />
      <BaseButton type="submit" :disabled="pending">
        {{ mode === 'create' ? 'Create table' : 'Save' }}
      </BaseButton>
    </form>
  </BaseModal>
</template>

<script setup lang="ts">
import { useId } from 'vue'
import { useForm } from '~/composables/useForm'
import { tableSchema } from '#shared/validation/table'

const props = withDefaults(
  defineProps<{
    mode: 'create' | 'rename'
    initialName?: string
    submitHandler: (name: string) => Promise<void>
  }>(),
  { initialName: '' },
)

const emit = defineEmits<{ saved: []; close: [] }>()

const inputId = useId()

const { form, errors, serverError, pending, submit } = useForm({
  schema: tableSchema,
  initial: { name: props.initialName },
  onSubmit: async ({ name }) => {
    await props.submitHandler(name)
    emit('saved')
  },
})
</script>

<style lang="scss" scoped>
.table-form {
  @include stack;

  &__server-error {
    @include error-banner;
  }
}
</style>
