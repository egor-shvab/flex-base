<template>
  <section class="dashboard">
    <header class="dashboard__header">
      <h1 class="dashboard__title">Your tables</h1>
      <BaseButton @click="openCreateModal">New table</BaseButton>
    </header>

    <p v-if="tablesStore.tables.length === 0" class="dashboard__empty">
      No tables yet — create your first table to get started.
    </p>

    <ul v-else class="dashboard__grid">
      <li v-for="table in tablesStore.tables" :key="table.id" class="table-card">
        <NuxtLink :to="`/tables/${table.id}/records`" class="table-card__link">
          <h2 class="table-card__name">{{ table.name }}</h2>
          <p class="table-card__meta">
            {{ table._count.fields }} fields · {{ table._count.records }} records
          </p>
        </NuxtLink>
        <div class="table-card__actions">
          <button type="button" class="table-card__action" @click="openRenameModal(table)">
            Rename
          </button>
          <button
            type="button"
            class="table-card__action table-card__action--danger"
            @click="deleteTarget = table"
          >
            Delete
          </button>
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
      :confirm-label="deletePending ? 'Deleting…' : 'Delete'"
      @confirm="confirmDelete"
      @close="deleteTarget = null"
    >
      Delete <strong>{{ deleteTarget.name }}</strong
      >? All of its fields and records will be permanently removed.
    </LazyConfirmModal>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAsyncData, useSeoMeta } from '#imports'
import { useTablesStore } from '~/stores/tables'
import type { ITableListItem } from '#shared/types/table'

useSeoMeta({ title: 'Your tables' })

type TFormModal = { mode: 'create' } | { mode: 'rename'; table: ITableListItem }

const tablesStore = useTablesStore()

await useAsyncData('tables', async () => {
  await tablesStore.fetchTables()
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

const deleteTarget = ref<ITableListItem | null>(null)
const deletePending = ref(false)

async function confirmDelete() {
  if (!deleteTarget.value) return

  deletePending.value = true
  try {
    await tablesStore.deleteTable(deleteTarget.value.id)
    deleteTarget.value = null
  } finally {
    deletePending.value = false
  }
}
</script>

<style lang="scss" scoped>
.dashboard {
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: rem(20);
  }

  &__title {
    margin: 0;
    font-size: rem(24);
  }

  &__empty {
    margin: rem(40) 0;
    text-align: center;
    color: var(--color-text-muted);
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
  border-radius: rem(10);
  background: var(--color-surface);

  &:hover {
    box-shadow: 0 4px 12px rgb(0 0 0 / 8%);
  }

  &__link {
    flex: 1;
    padding: rem(16);
    text-decoration: none;
    color: inherit;
  }

  &__name {
    margin: 0 0 rem(4);
    font-size: rem(17);
  }

  &__meta {
    margin: 0;
    font-size: rem(13);
    color: var(--color-text-muted);
  }

  &__actions {
    display: flex;
    gap: rem(8);
    padding: rem(8) rem(16);
    border-top: 1px solid var(--color-border);
  }

  &__action {
    padding: 0;
    border: none;
    background: none;
    font-size: rem(13);
    color: var(--color-text-muted);
    cursor: pointer;

    &:hover {
      color: var(--color-primary);
    }

    &--danger:hover {
      color: var(--color-danger);
    }
  }
}
</style>
