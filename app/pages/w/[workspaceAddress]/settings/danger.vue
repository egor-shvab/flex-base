<template>
  <section class="settings-danger" :aria-labelledby="titleId">
    <BaseSectionHead title="Danger zone" :title-id="titleId" />

    <BaseCard v-if="isOwner" tone="danger">
      <BaseActionRow title="Transfer ownership" tone="danger">
        Hand the workspace to another member. You stay in it as {{ membership?.role.name }}, and
        only they can delete it or hand it on.
        <template #action>
          <BaseButton variant="secondary" @click="isTransferOpen = true">
            Transfer ownership
          </BaseButton>
        </template>
      </BaseActionRow>

      <BaseActionRow title="Delete workspace" tone="danger">
        {{ contentsSummary }} Members lose access immediately. This cannot be undone.
        <template #action>
          <BaseButton variant="danger" @click="deleteTarget = workspaceAddress">
            Delete workspace
          </BaseButton>
        </template>
      </BaseActionRow>
    </BaseCard>

    <BaseCard v-else tone="danger">
      <BaseActionRow title="Leave workspace" tone="danger">
        You lose access to its tables and records. To come back, someone has to invite you again.
        <template #action>
          <BaseButton variant="danger" @click="leaveTarget = workspaceAddress">
            Leave workspace
          </BaseButton>
        </template>
      </BaseActionRow>
    </BaseCard>

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
</style>
