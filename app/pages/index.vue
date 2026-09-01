<template>
  <section class="dashboard">
    <header class="dashboard__header">
      <h1 class="dashboard__title">Your tables</h1>
      <BaseButton @click="openCreateModal">Add table</BaseButton>
    </header>

    <BaseEmptyState v-if="tablesStore.tables.length === 0" title="No tables yet" icon="mdi:table">
      A table is a list of things you want to keep track of — customers, deals, invoices.
      <template #action>
        <BaseButton @click="openCreateModal">Add table</BaseButton>
      </template>
    </BaseEmptyState>

    <ul v-else class="dashboard__grid">
      <li v-for="table in tablesStore.tables" :key="table.id" class="table-card">
        <NuxtLink :to="`/tables/${toTableAddress(table)}`" class="table-card__link">
          <h2 class="table-card__name">{{ table.name }}</h2>
          <p class="table-card__meta">
            {{ table._count.fields }} fields · {{ table._count.records }} records
          </p>
        </NuxtLink>
        <div class="table-card__actions">
          <BaseButton variant="link" @click="openRenameModal(table)">Rename</BaseButton>
          <BaseButton variant="link" tone="danger" @click="deleteTarget = table">
            Delete
          </BaseButton>
        </div>
      </li>
    </ul>

    <LazyTableFormModal
      v-if="tableModalOpen"
      :mode="editingTable ? 'rename' : 'create'"
      :initial-name="editingTable?.name ?? ''"
      :submit-handler="submitTable"
      @saved="closeTableModal"
      @close="closeTableModal"
    />

    <LazyConfirmModal
      v-if="deleteTarget"
      title="Delete table"
      danger
      v-bind="deleteDialog"
      @confirm="confirmDelete"
      @close="cancelDelete"
    >
      Delete <strong>{{ deleteTarget.name }}</strong
      >? All of its fields and records will be permanently removed. This cannot be undone.
    </LazyConfirmModal>
  </section>
</template>

<script setup lang="ts">
import { useSeoMeta } from '#imports'
import { useDeleteConfirm } from '~/composables/useDeleteConfirm'
import { useEntityFormModal } from '~/composables/useEntityFormModal'
import { useTablesStore } from '~/stores/tables'
import type { ITableListItem } from '#shared/types/table'
import { toTableAddress } from '#shared/utils/address'

useSeoMeta({ title: 'Your tables' })

// No fetch of its own: the layout's `ensureTables` loads the list, and the records and fields
// stores tell this one whenever a write moves a count — refetching here instead would fix Home
// and leave the sidebar's counts stale everywhere else
const tablesStore = useTablesStore()

const {
  open: tableModalOpen,
  editing: editingTable,
  openCreate: openCreateModal,
  openEdit: openRenameModal,
  close: closeTableModal,
} = useEntityFormModal<ITableListItem>()

// Throws (e.g. 409) propagate into TableFormModal's useForm, which shows the error
async function submitTable(name: string) {
  if (editingTable.value) {
    await tablesStore.renameTable(editingTable.value.id, { name })
  } else {
    await tablesStore.createTable({ name })
  }
}

const {
  target: deleteTarget,
  dialogProps: deleteDialog,
  confirm: confirmDelete,
  cancel: cancelDelete,
} = useDeleteConfirm((table: ITableListItem) => tablesStore.deleteTable(toTableAddress(table)))
</script>

<style lang="scss" scoped>
.dashboard {
  &__header {
    @include page-header;
  }

  &__title {
    @include page-title;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(rem(220), 1fr));
    gap: rem(16);
    margin: 0;
    padding: 0;
    list-style: none;
  }
}

.table-card {
  @include surface-card;

  display: flex;
  flex-direction: column;

  &:hover,
  &:has(:focus-visible) {
    border-color: var(--color-border-strong);
    box-shadow: var(--shadow-sm);
  }

  // The link fills the card, so the card wears the ring — on the link it would draw a square
  // rect straddling the rounded corner and the actions divider. `:has(:focus-visible)` rather
  // than `:focus-within`, which also fires on a click.
  &:has(:focus-visible) {
    outline: var(--focus-ring-width) solid var(--color-focus);
    outline-offset: var(--focus-ring-offset);
    // Composed rather than replaced: the rule above lifts the card on focus, and a bare halo
    // would drop that lift
    box-shadow: var(--shadow-sm), var(--focus-ring-halo);
  }

  &__link {
    flex: 1;
    padding: rem(16);
    text-decoration: none;
    color: inherit;

    // Both halves, or the baseline's halo still paints the rect the outline was suppressed for
    &:focus-visible {
      outline: none;
      box-shadow: none;
    }
  }

  &__name {
    margin: 0 0 rem(4);
    font-size: var(--font-size-lg);
  }

  &__meta {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  &__actions {
    display: flex;
    gap: rem(8);
    padding: rem(8) rem(16);
    border-top: 1px solid var(--color-border);
  }
}
</style>
