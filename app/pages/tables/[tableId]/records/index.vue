<template>
  <section class="records-page">
    <NuxtLink to="/" class="records-page__back">
      <Icon name="mdi:arrow-left" aria-hidden="true" />
      Your tables
    </NuxtLink>

    <header class="records-page__header">
      <h1 class="records-page__title">{{ table?.name }}</h1>
      <div class="records-page__header-actions">
        <NuxtLink :to="`/tables/${tableId}`" class="records-page__link">Fields</NuxtLink>
        <BaseButton :disabled="!hasFields" @click="openCreateRecord">New record</BaseButton>
      </div>
    </header>

    <p v-if="!hasFields" class="records-page__empty">
      This table has no fields yet —
      <NuxtLink :to="`/tables/${tableId}`" class="records-page__link">define its fields</NuxtLink>
      before adding records.
    </p>

    <p v-else-if="recordsStore.records.length === 0" class="records-page__empty">
      No records yet — add your first record.
    </p>

    <template v-else>
      <DynamicTable
        :fields="fieldsStore.fields"
        :records="recordsStore.records"
        @edit="openEditRecord"
        @delete="deleteTarget = $event"
      />

      <BasePagination
        class="records-page__pagination"
        :page="recordsStore.page"
        :page-count="recordsStore.pageCount"
        :page-size="recordsStore.pageSize"
        :total="recordsStore.total"
        @update:page="goToPage"
      />
    </template>

    <LazyRecordFormModal
      v-if="recordModal"
      :mode="recordModal.mode"
      :fields="fieldsStore.fields"
      :record="recordModal.mode === 'edit' ? recordModal.record : undefined"
      :submit-handler="submitRecord"
      @saved="recordModal = null"
      @close="recordModal = null"
    />

    <LazyConfirmModal
      v-if="deleteTarget"
      title="Delete record"
      danger
      :pending="deletePending"
      :confirm-label="deletePending ? 'Deleting…' : 'Delete'"
      @confirm="confirmDeleteRecord"
      @close="deleteTarget = null"
    >
      Delete this record? This cannot be undone.
    </LazyConfirmModal>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { createError, useAsyncData, useRoute, useSeoMeta } from '#imports'
import { useApi } from '~/composables/useApi'
import { useFieldsStore } from '~/stores/fields'
import { useRecordsStore } from '~/stores/records'
import type { ITable } from '#shared/types/table'
import type { IRecord, TRecordData } from '#shared/types/record'

type TRecordModal = { mode: 'create' } | { mode: 'edit'; record: IRecord }

const route = useRoute()
const api = useApi()
const fieldsStore = useFieldsStore()
const recordsStore = useRecordsStore()
const tableId = route.params.tableId as string

const { data, error } = await useAsyncData(`table-records-${tableId}`, async () => {
  const [tableResponse] = await Promise.all([
    api<{ table: ITable }>(`/api/tables/${tableId}`),
    fieldsStore.fetchFields(tableId),
    recordsStore.fetchRecords(tableId, 1),
  ])
  return tableResponse
})

if (error.value) {
  throw createError({ statusCode: error.value.statusCode ?? 404, statusMessage: 'Table not found' })
}

const table = computed(() => data.value?.table)
useSeoMeta({ title: () => table.value?.name ?? 'Records' })

const hasFields = computed(() => fieldsStore.fields.length > 0)

function goToPage(nextPage: number) {
  return recordsStore.fetchRecords(tableId, nextPage)
}

const recordModal = ref<TRecordModal | null>(null)

function openCreateRecord() {
  recordModal.value = { mode: 'create' }
}

function openEditRecord(record: IRecord) {
  recordModal.value = { mode: 'edit', record }
}

// Throws (400/404) propagate into RecordFormModal's useForm, which shows the error
async function submitRecord(data: TRecordData) {
  if (recordModal.value?.mode === 'edit') {
    await recordsStore.updateRecord(tableId, recordModal.value.record.id, data)
  } else {
    await recordsStore.createRecord(tableId, data)
  }
}

const deleteTarget = ref<IRecord | null>(null)
const deletePending = ref(false)

async function confirmDeleteRecord() {
  if (!deleteTarget.value) return
  deletePending.value = true
  try {
    await recordsStore.deleteRecord(tableId, deleteTarget.value.id)
    deleteTarget.value = null
  } finally {
    deletePending.value = false
  }
}
</script>

<style lang="scss" scoped>
.records-page {
  &__back {
    display: inline-flex;
    align-items: center;
    gap: rem(4);
    margin-bottom: rem(12);
    font-size: rem(14);
    color: var(--color-text-muted);
    text-decoration: none;

    &:hover {
      color: var(--color-primary);
    }
  }

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

  &__header-actions {
    display: flex;
    align-items: center;
    gap: rem(16);
  }

  &__link {
    font-size: rem(14);
    color: var(--color-primary);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  &__empty {
    margin: rem(40) 0;
    text-align: center;
    color: var(--color-text-muted);
  }

  // Placement only — BasePagination owns its internal layout
  &__pagination {
    margin-top: rem(12);
  }
}
</style>
