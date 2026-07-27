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
        <BaseButton
          v-if="hasFields"
          variant="ghost"
          icon="mdi:filter-variant"
          @click="filterPanelOpen = true"
        >
          Filters
          <BaseBadge v-if="activeFilterCount > 0" variant="label">
            {{ activeFilterCount }}
          </BaseBadge>
        </BaseButton>
        <BaseButton :disabled="!hasFields" @click="openCreateRecord">New record</BaseButton>
      </div>
    </header>

    <p v-if="!hasFields" class="records-page__empty">
      This table has no fields yet —
      <NuxtLink :to="`/tables/${tableId}`" class="records-page__link">define its fields</NuxtLink>
      before adding records.
    </p>

    <template v-else>
      <div v-if="recordsStore.records.length === 0" class="records-page__empty">
        <template v-if="activeFilterCount > 0">
          <p>No records match these filters.</p>
          <BaseButton variant="ghost" icon="mdi:filter-remove-outline" @click="applyFilters({})">
            Clear all filters
          </BaseButton>
        </template>
        <p v-else>No records yet — add your first record.</p>
      </div>

      <template v-else>
        <DynamicTable
          :fields="fieldsStore.fields"
          :records="recordsStore.records"
          :sort="queryParams.sort"
          @edit="openEditRecord"
          @delete="deleteTarget = $event"
          @sort="applySort"
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
    </template>

    <LazyRecordsFilterPanel
      v-if="filterPanelOpen"
      :fields="fieldsStore.fields"
      :filters="filters"
      :total="recordsStore.total"
      :pending="recordsStore.pending"
      @update:filters="applyFilters"
      @close="filterPanelOpen = false"
    />

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
import { computed, ref, watch } from 'vue'
import { createError, navigateTo, useAsyncData, useRoute, useSeoMeta } from '#imports'
import { useApi } from '~/composables/useApi'
import { useFieldsStore } from '~/stores/fields'
import { useRecordsStore } from '~/stores/records'
import type { ITable } from '#shared/types/table'
import type { TRecordFilterValues } from '#shared/types/filter'
import type { IRecord, IRecordQueryState, TRecordData } from '#shared/types/record'
import { parseRecordQueryState, toRecordQueryParams } from '#shared/utils/record-query'

type TRecordModal = { mode: 'create' } | { mode: 'edit'; record: IRecord }

const route = useRoute()
const api = useApi()
const fieldsStore = useFieldsStore()
const recordsStore = useRecordsStore()
const tableId = route.params.tableId as string

/** The URL is the source of truth for the list query, so a filtered view is shareable. */
const queryParams = computed<IRecordQueryState>(() =>
  parseRecordQueryState(fieldsStore.fields, route.query),
)

const filters = computed(() => queryParams.value.filters)

/** One filtered field counts once, however many conditions its control implies. */
const activeFilterCount = computed(() => Object.keys(filters.value).length)

const { data, error } = await useAsyncData(`table-records-${tableId}`, async () => {
  const [tableResponse] = await Promise.all([
    api<{ table: ITable }>(`/api/tables/${tableId}`),
    fieldsStore.fetchFields(tableId),
  ])
  // Filters decode against field metadata, so this waits rather than running in parallel —
  // otherwise a shared filter URL would render unfiltered on first load.
  await recordsStore.fetchRecords(tableId, queryParams.value)
  return tableResponse
})

// Every list change goes through the URL, so one watcher covers filtering, sorting and paging
watch(queryParams, (params) => recordsStore.fetchRecords(tableId, params))

if (error.value) {
  throw createError({ statusCode: error.value.statusCode ?? 404, statusMessage: 'Table not found' })
}

const table = computed(() => data.value?.table)
useSeoMeta({ title: () => table.value?.name ?? 'Records' })

const hasFields = computed(() => fieldsStore.fields.length > 0)

function applyQuery(params: IRecordQueryState, replace = false) {
  // Sort and page steps are worth a history entry; live filter edits would flood it
  return navigateTo({ query: toRecordQueryParams(params) }, { replace })
}

function goToPage(nextPage: number) {
  return applyQuery({ ...queryParams.value, page: nextPage })
}

/** Re-clicking the sorted column flips it; a new column starts ascending. */
function applySort(key: string) {
  const { sort } = queryParams.value
  const dir = sort.key === key && sort.dir === 'asc' ? 'desc' : 'asc'
  return applyQuery({ ...queryParams.value, page: 1, sort: { key, dir } })
}

function applyFilters(next: TRecordFilterValues) {
  return applyQuery({ ...queryParams.value, page: 1, filters: next }, true)
}

const filterPanelOpen = ref(false)

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
    await recordsStore.updateRecord(tableId, recordModal.value.record.id, data, queryParams.value)
    return
  }

  // A new record lands on page 1 of the default view; keep the URL in step rather than
  // letting the store show a page the address bar disagrees with
  const nextPage = await recordsStore.createRecord(tableId, data, queryParams.value)
  if (nextPage !== queryParams.value.page) {
    await applyQuery({ ...queryParams.value, page: nextPage }, true)
  }
}

const deleteTarget = ref<IRecord | null>(null)
const deletePending = ref(false)

async function confirmDeleteRecord() {
  if (!deleteTarget.value) return
  deletePending.value = true
  try {
    await recordsStore.deleteRecord(tableId, deleteTarget.value.id, queryParams.value)
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
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: rem(8);
    margin: rem(40) 0;
    text-align: center;
    color: var(--color-text-muted);

    p {
      margin: 0;
    }
  }

  // Placement only — BasePagination owns its internal layout
  &__pagination {
    margin-top: rem(12);
  }
}
</style>
