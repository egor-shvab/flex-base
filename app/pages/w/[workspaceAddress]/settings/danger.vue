<template>
  <section class="settings-danger" :aria-labelledby="titleId">
    <div class="section-head">
      <h2 :id="titleId" class="section-head__title">Danger zone</h2>
    </div>

    <div v-if="isOwner" class="danger-card">
      <div class="danger-card__row">
        <div class="danger-card__text">
          <h3 class="danger-card__title">Transfer ownership</h3>
          <p class="danger-card__description">
            Hand the workspace to another member. You stay in it as {{ membership?.role.name }}, and
            only they can delete it or hand it on.
          </p>
        </div>
        <BaseButton variant="secondary" class="danger-card__action" @click="isTransferOpen = true">
          Transfer ownership
        </BaseButton>
      </div>

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

    <div v-else class="danger-card">
      <div class="danger-card__row">
        <div class="danger-card__text">
          <h3 class="danger-card__title">Leave workspace</h3>
          <p class="danger-card__description">
            You lose access to its tables and records. To come back, someone has to invite you
            again.
          </p>
        </div>
        <BaseButton
          variant="danger"
          class="danger-card__action"
          @click="leaveTarget = workspaceAddress"
        >
          Leave workspace
        </BaseButton>
      </div>
    </div>

    <LazyTransferOwnershipModal
      v-if="isTransferOpen && membership"
      :workspace-address="workspaceAddress"
      :own-role-name="membership.role.name"
      :submit-handler="transferOwnership"
      @saved="isTransferOpen = false"
      @close="isTransferOpen = false"
    />

    <LazyConfirmModal
      v-if="leaveTarget && membership"
      title="Leave workspace"
      danger
      v-bind="leaveDialog"
      confirm-label="Leave workspace"
      @confirm="confirmLeave"
      @close="cancelLeave"
    >
      Leave “{{ membership.workspace.name }}”? You lose access right away.
    </LazyConfirmModal>

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
import { computed, ref, useId } from 'vue'
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

const isTransferOpen = ref(false)

async function transferOwnership(memberId: string) {
  await workspacesStore.transferOwnership(workspaceAddress.value, memberId)
}

const {
  target: leaveTarget,
  dialogProps: leaveDialog,
  confirm: confirmLeave,
  cancel: cancelLeave,
} = useDeleteConfirm(async (address: string) => {
  await workspacesStore.leaveWorkspace(address)
  await navigateTo('/', { replace: true })
})
</script>

<style lang="scss" scoped>
.settings-danger {
  @include stack(10);
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

    & + & {
      border-top: 1px solid var(--color-danger-edge);
    }
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
