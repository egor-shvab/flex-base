<template>
  <section v-if="membership" class="settings-general" :aria-labelledby="titleId">
    <div class="section-head">
      <h2 :id="titleId" class="section-head__title">General</h2>
    </div>

    <form class="settings-general__form" novalidate @submit.prevent="submit">
      <BaseErrorBanner :message="serverError" />

      <BaseCard>
        <BaseDetailList>
          <BaseDetailRow term="Workspace name" :label-for="canRename ? nameInputId : undefined">
            <BaseInput
              v-if="canRename"
              :id="nameInputId"
              v-model.trim="form.name"
              class="settings-general__name"
              :error="errors.name"
            />
            <template v-else>{{ membership.workspace.name }}</template>
          </BaseDetailRow>

          <BaseDetailRow term="Workspace ID" variant="address">
            {{ membership.workspace.publicId }}
          </BaseDetailRow>

          <BaseDetailRow term="Created">
            {{ formatTimestamp(membership.workspace.createdAt) }}
          </BaseDetailRow>
        </BaseDetailList>
      </BaseCard>

      <div v-if="canRename" class="settings-general__actions">
        <BaseButton type="submit" :loading="isSubmitting">Save changes</BaseButton>
        <BaseButton variant="secondary" :disabled="isSubmitting" @click="discardChanges">
          Discard
        </BaseButton>
        <p class="settings-general__status" role="status">{{ savedMessage }}</p>
      </div>
    </form>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { useActiveWorkspace } from '~/composables/useActiveWorkspace'
import { useForm } from '~/composables/useForm'
import { useWorkspacesStore } from '~/stores/workspaces'
import { formatTimestamp } from '~/utils/format'
import { workspaceInputSchema } from '#shared/validation/workspace'

const workspacesStore = useWorkspacesStore()
const { workspaceAddress, membership, hasPermission } = useActiveWorkspace()

const titleId = useId()
const nameInputId = useId()

const canRename = computed(() => hasPermission('WORKSPACE_UPDATE'))

const savedMessage = ref('')

const { form, errors, serverError, isSubmitting, submit } = useForm({
  schema: workspaceInputSchema,
  initial: { name: membership.value?.workspace.name ?? '' },
  onSubmit: async (values) => {
    await workspacesStore.renameWorkspace(workspaceAddress.value, values)
    savedMessage.value = 'Changes saved.'
  },
})

watch(
  () => form.name,
  () => (savedMessage.value = ''),
)

function discardChanges() {
  form.name = membership.value?.workspace.name ?? ''
}
</script>

<style lang="scss" scoped>
.settings-general {
  @include stack(10);

  &__form {
    @include stack(16);
  }

  &__name {
    max-width: rem(340);
  }

  &__actions {
    @include cluster(10);
  }

  &__status {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }
}
</style>
