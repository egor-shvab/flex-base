<template>
  <section class="dashboard">
    <header class="dashboard__header">
      <h1 class="dashboard__title">Your tables</h1>
      <BaseButton @click="openCreateModal">Add table</BaseButton>
    </header>

    <BaseEmptyState v-if="tablesStore.tables.length === 0" title="No tables yet">
      A table is a list of things you want to keep track of — customers, deals, invoices.
      <template #action>
        <BaseButton @click="openCreateModal">Add table</BaseButton>
      </template>
    </BaseEmptyState>

    <ul v-else class="dashboard__grid">
      <li v-for="table in tablesStore.tables" :key="table.id" class="table-card">
        <NuxtLink :to="`/tables/${table.id}/records`" class="table-card__link">
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
      v-if="formModal"
      :mode="formModal.mode"
      :initial-name="formModal.mode === 'rename' ? formModal.table.name : ''"
      :submit-handler="submitTable"
      @saved="formModal = null"
      @close="formModal = null"
    />

    <LazyConfirmModal
      v-if="deleteTarget"
      title="Delete table"
      danger
      :pending="deletePending"
      :confirm-label="deleteLabel"
      @confirm="confirmDelete"
      @close="cancelDelete"
    >
      Delete <strong>{{ deleteTarget.name }}</strong
      >? All of its fields and records will be permanently removed. This cannot be undone.
    </LazyConfirmModal>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAsyncData, useSeoMeta } from '#imports'
import { useDeleteConfirm } from '~/composables/useDeleteConfirm'
import { useTablesStore } from '~/stores/tables'
import type { ITableListItem } from '#shared/types/table'

useSeoMeta({ title: 'Your tables' })

type TFormModal = { mode: 'create' } | { mode: 'rename'; table: ITableListItem }

const tablesStore = useTablesStore()

// The layout already loaded the list for SSR, so this only refreshes on client-side
// entry — Home is the one screen where the record counts *are* the content, and they
// drift as records are added elsewhere. Its own key, so it never collides with the
// layout's (`useAsyncData` does not dedupe a layout against a page).
await useAsyncData('dashboard-tables', async () => {
  if (import.meta.client) await tablesStore.fetchTables()
  return true
})

const formModal = ref<TFormModal | null>(null)

function openCreateModal() {
  formModal.value = { mode: 'create' }
}

function openRenameModal(table: ITableListItem) {
  formModal.value = { mode: 'rename', table }
}

// Throws (e.g. 409) propagate into TableFormModal's useForm, which shows the error
async function submitTable(name: string) {
  if (!formModal.value) return
  if (formModal.value.mode === 'rename') {
    await tablesStore.renameTable(formModal.value.table.id, { name })
  } else {
    await tablesStore.createTable({ name })
  }
}

const {
  target: deleteTarget,
  pending: deletePending,
  confirmLabel: deleteLabel,
  confirm: confirmDelete,
  cancel: cancelDelete,
} = useDeleteConfirm((table: ITableListItem) => tablesStore.deleteTable(table.id))
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
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);

  &:hover,
  &:has(:focus-visible) {
    border-color: var(--color-border-strong);
    box-shadow: var(--shadow-sm);
  }

  // The link fills the card, so the card wears the ring — a ring on the link itself
  // would draw a square rect straddling the rounded corner and the actions divider.
  // `:has(:focus-visible)` rather than `:focus-within`, which also fires on a click.
  &:has(:focus-visible) {
    outline: var(--focus-ring-width) solid var(--color-focus);
    outline-offset: var(--focus-ring-offset);
  }

  &__link {
    flex: 1;
    padding: rem(16);
    text-decoration: none;
    color: inherit;

    &:focus-visible {
      outline: none;
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
