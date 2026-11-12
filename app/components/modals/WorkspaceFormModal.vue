<template>
  <BaseModal title="New workspace" @close="emit('close')">
    <form :id="formId" class="workspace-form" novalidate @submit.prevent="submit">
      <BaseErrorBanner :message="serverError" />

      <BaseInput
        :id="inputId"
        v-model.trim="form.name"
        label="Workspace name"
        placeholder="e.g. Acme Sales"
        hint="You can rename it later in its settings."
        autofocus
        :error="errors.name"
      />
    </form>

    <template #footer>
      <BaseButton variant="secondary" :disabled="isSubmitting" @click="emit('close')"
        >Cancel</BaseButton
      >
      <BaseButton type="submit" :form="formId" :loading="isSubmitting">Create workspace</BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { useId } from 'vue'
import { navigateTo } from '#imports'
import { useForm } from '~/composables/useForm'
import { useWorkspacesStore } from '~/stores/workspaces'
import { pagePath } from '~/utils/page-path'
import { workspaceInputSchema } from '#shared/validation/workspace'

const emit = defineEmits<{ saved: []; close: [] }>()

const workspacesStore = useWorkspacesStore()

const inputId = useId()
const formId = useId()

const { form, errors, serverError, isSubmitting, submit } = useForm({
  schema: workspaceInputSchema,
  initial: { name: '' },
  onSubmit: async (values) => {
    const membership = await workspacesStore.createWorkspace(values)
    emit('saved')
    await navigateTo(pagePath.workspace(membership.workspace.publicId))
  },
})
</script>

<style lang="scss" scoped>
.workspace-form {
  @include stack;
}
</style>
