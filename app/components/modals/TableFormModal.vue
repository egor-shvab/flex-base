<template>
  <BaseModal :title="mode === 'create' ? 'New table' : 'Rename table'" @close="emit('close')">
    <form :id="formId" class="table-form" novalidate @submit.prevent="submit">
      <BaseErrorBanner :message="serverError" />

      <BaseInput
        :id="inputId"
        v-model.trim="form.name"
        label="Table name"
        placeholder="e.g. Customers"
        autofocus
        :error="errors.name"
      />
    </form>

    <template #footer>
      <BaseButton variant="secondary" :disabled="pending" @click="emit('close')">Cancel</BaseButton>
      <BaseButton type="submit" :form="formId" :loading="pending">
        {{ mode === 'create' ? 'Create table' : 'Save' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { useId } from 'vue'
import { useForm } from '~/composables/useForm'
import { tableInputSchema } from '#shared/validation/table'

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
const formId = useId()

const { form, errors, serverError, pending, submit } = useForm({
  schema: tableInputSchema,
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
}
</style>
