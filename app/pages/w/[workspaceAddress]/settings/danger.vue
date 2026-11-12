<template>
  <section class="settings-danger" :aria-labelledby="titleId">
    <div class="section-head">
      <h2 :id="titleId" class="section-head__title">Danger zone</h2>
    </div>

    <div v-if="isOwner" class="danger-card">
      <div class="danger-card__row">
        <div class="danger-card__text">
          <h3 class="danger-card__title">Delete workspace</h3>
          <p class="danger-card__description">
            {{ contentsSummary }} Members lose access immediately. This cannot be undone.
          </p>
        </div>
        <BaseButton
          variant="danger"
          class="danger-card__action"
          @click="deleteTarget = workspaceAddress"
        >
          Delete workspace
        </BaseButton>
      </div>
    </div>

    <p v-else class="settings-danger__note">Only the workspace owner can delete it.</p>

    <LazyConfirmModal
      v-if="deleteTarget && membership"
      title="Delete workspace"
      danger
      v-bind="deleteDialog"
      confirm-label="Delete workspace"
      :confirm-phrase="membership.workspace.name"
      @confirm="confirmDelete"
      @close="cancelDelete"
    >
      “{{ membership.workspace.name }}” and everything in it will be deleted for every member.
    </LazyConfirmModal>
  </section>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
import { navigateTo } from '#imports'
import { useActiveWorkspace } from '~/composables/useActiveWorkspace'
import { useDeleteConfirm } from '~/composables/useDeleteConfirm'
import { useTablesStore } from '~/stores/tables'
import { useWorkspacesStore } from '~/stores/workspaces'
import { formatCount } from '~/utils/format'

const workspacesStore = useWorkspacesStore()
const tablesStore = useTablesStore()
const { workspaceAddress, membership, isOwner } = useActiveWorkspace()

const titleId = useId()

/** Counted only from a list known to be this workspace's: a stale one would misstate the loss. */
const contentsSummary = computed(() => {
  if (
    tablesStore.status !== 'ready' ||
    tablesStore.loadedWorkspaceAddress !== workspaceAddress.value
  ) {
    return 'All its tables and records are removed.'
  }
  if (tablesStore.tables.length === 0) return 'It has no tables yet.'

  const recordCount = tablesStore.tables.reduce((sum, table) => sum + table._count.records, 0)
  const tableCount = formatCount(tablesStore.tables.length, 'table')
  return `${tableCount} and ${formatCount(recordCount, 'record')} are removed.`
})

const {
  target: deleteTarget,
  dialogProps: deleteDialog,
  confirm: confirmDelete,
  cancel: cancelDelete,
} = useDeleteConfirm(async (address: string) => {
  await workspacesStore.deleteWorkspace(address)
  await navigateTo('/', { replace: true })
})
</script>

<style lang="scss" scoped>
.settings-danger {
  @include stack(10);

  &__note {
    margin: 0;
    font-size: var(--font-size-md);
    color: var(--color-text-secondary);
  }
}

.danger-card {
  border: 1px solid var(--color-danger-edge);
  border-radius: var(--radius-lg);
  background: var(--color-surface);

  &__row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: rem(14);
    padding: rem(16);
  }

  &__text {
    @include stack(4);

    flex: 1;
    min-width: rem(220);
  }

  &__title {
    margin: 0;
    font-size: var(--font-size-body);
    font-weight: 600;
  }

  &__description {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  &__action {
    flex: none;
  }
}
</style>
