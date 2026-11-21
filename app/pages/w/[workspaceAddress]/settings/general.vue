<template>
  <section v-if="membership" class="settings-general" :aria-labelledby="titleId">
    <BaseSectionHead title="General" :title-id="titleId" />

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
        <BaseButton type="submit" :disabled="!isDirty" :loading="isSubmitting">
          Save changes
        </BaseButton>
        <BaseButton variant="secondary" :disabled="!isDirty" :busy="isSubmitting" @click="discard">
          Discard
        </BaseButton>
        <p class="g-note" role="status">{{ hasSaved && !isDirty ? 'Changes saved.' : '' }}</p>
      </div>
    </form>
  </section>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
import { useActiveWorkspace } from '~/composables/useActiveWorkspace'
import { useSavedForm } from '~/composables/useSavedForm'
import { useWorkspacesStore } from '~/stores/workspaces'
import { formatTimestamp } from '~/utils/format'
import { workspaceInputSchema } from '#shared/validation/workspace'

const workspacesStore = useWorkspacesStore()
const { workspaceAddress, membership, hasPermission } = useActiveWorkspace()

const titleId = useId()
const nameInputId = useId()

const canRename = computed(() => hasPermission('WORKSPACE_UPDATE'))

const { form, errors, serverError, isSubmitting, submit, isDirty, hasSaved, discard } =
  useSavedForm({
    schema: workspaceInputSchema,
    initial: { name: membership.value?.workspace.name ?? '' },
    save: async (values) => {
      await workspacesStore.renameWorkspace(workspaceAddress.value, values)
      return { name: values.name }
    },
    isSame: (a, b) => a.name === b.name,
  })
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
}
</style>
