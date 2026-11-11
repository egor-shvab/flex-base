<template>
  <BaseModal title="Edit profile" @close="emit('close')">
    <form :id="formId" class="profile-form" novalidate @submit.prevent="submit">
      <BaseErrorBanner :message="serverError" />

      <BaseInput
        :id="inputId"
        v-model="form.name"
        label="Name"
        autocomplete="name"
        hint="Shown to people you work with."
        autofocus
        :error="errors.name"
      />
    </form>

    <template #footer>
      <BaseButton variant="secondary" :disabled="isSubmitting" @click="emit('close')"
        >Cancel</BaseButton
      >
      <BaseButton type="submit" :form="formId" :loading="isSubmitting">Save</BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { useId } from 'vue'
import { useForm } from '~/composables/useForm'
import { useAuthStore } from '~/stores/auth'
import { profileInputSchema } from '#shared/validation/auth'

const emit = defineEmits<{ saved: []; close: [] }>()

const auth = useAuthStore()

const inputId = useId()
const formId = useId()

const { form, errors, serverError, isSubmitting, submit } = useForm({
  schema: profileInputSchema,
  initial: { name: auth.user?.name ?? '' },
  onSubmit: async (values) => {
    await auth.updateProfile(values)
    emit('saved')
  },
})
</script>

<style lang="scss" scoped>
.profile-form {
  @include stack;
}
</style>
