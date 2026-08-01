<template>
  <section class="records-page">
    <AppBreadcrumbs :items="breadcrumbs" />

    <header class="records-page__header">
      <h1 class="records-page__title">{{ table?.name }}</h1>
      <div class="records-page__header-actions">
        <NuxtLink :to="`/tables/${tableId}`" class="records-page__link">Fields</NuxtLink>
        <BaseInput
          v-if="hasFields"
          id="records-search"
          class="records-page__search"
          :model-value="queryParams.search"
          type="text"
          aria-label="Search this table"
          placeholder="Search…"
          trim
          :debounce="SEARCH_DEBOUNCE_MS"
          @update:model-value="applySearch"
        />
        <BaseButton
          v-if="hasFields"
          variant="ghost"
          icon="mdi:filter-variant"
          @click="filterPanelOpen = true"
        >
          Filters
        </BaseButton>
        <BaseButton :disabled="!hasFields" @click="openCreateRecord">New record</BaseButton>
      </div>
    </header>

    <!-- The active filters are stated above the data rather than hidden behind the
         drawer that covers it -->
    <RecordsFilterSummary
      v-if="hasFields && isNarrowed"
      :fields="fieldsStore.fields"
      :filters="filters"
      :search="queryParams.search"
      :total="recordsStore.total"
      :pending="recordsStore.pending"
      @update:filters="applyFilters"
      @update:search="applySearch"
      @clear="clearNarrowing"
    />

    <BaseEmptyState v-if="!hasFields">
      This table has no fields yet —
      <NuxtLink :to="`/tables/${tableId}`" class="records-page__link">define its fields</NuxtLink>
      before adding records.
    </BaseEmptyState>

    <template v-else>
      <BaseEmptyState v-if="recordsStore.records.length === 0" :title="emptyTitle">
        {{ emptyMessage }}
        <template #action>
          <BaseButton v-if="isNarrowed" @click="clearNarrowing">Show all records</BaseButton>
          <BaseButton v-else @click="openCreateRecord">New record</BaseButton>
        </template>
      </BaseEmptyState>

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
      :confirm-label="deleteLabel"
      @confirm="confirmDeleteRecord"
      @close="cancelDelete"
    >
      Delete record #{{ deleteTarget.number }}? This cannot be undone.
    </LazyConfirmModal>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { createError, navigateTo, useAsyncData, useRoute, useSeoMeta } from '#imports'
import { useApi } from '~/composables/useApi'
import { useDeleteConfirm } from '~/composables/useDeleteConfirm'
import { useFieldsStore } from '~/stores/fields'
import { useRecordsStore } from '~/stores/records'
import { useRelationsStore } from '~/stores/relations'
import { SEARCH_MIN_LENGTH } from '#shared/constants/filter'
import type { IBreadcrumb } from '~/types/breadcrumb'
import type { ITable } from '#shared/types/table'
import type { TRecordFilterValues } from '#shared/types/filter'
import type { IRecord, IRecordQueryState, TRecordData } from '#shared/types/record'
import { parseRecordQueryState, toRecordQueryParams } from '#shared/utils/record-query'

type TRecordModal = { mode: 'create' } | { mode: 'edit'; record: IRecord }

/** The same hold the filter controls use — a keystroke must not hit the API. */
const SEARCH_DEBOUNCE_MS = 300

const route = useRoute()
const api = useApi()
const fieldsStore = useFieldsStore()
const recordsStore = useRecordsStore()
const relationsStore = useRelationsStore()
const tableId = route.params.tableId as string

/** The URL is the source of truth for the list query, so a filtered view is shareable. */
const queryParams = computed<IRecordQueryState>(() =>
  parseRecordQueryState(fieldsStore.fields, route.query),
)

const filters = computed(() => queryParams.value.filters)

/** One filtered field counts once, however many conditions its control implies. */
const activeFilterCount = computed(() => Object.keys(filters.value).length)

/** Whether the list is showing less than the whole table, by filter or by search. */
const isNarrowed = computed(() => activeFilterCount.value > 0 || queryParams.value.search !== '')

const { data, error } = await useAsyncData(`table-records-${tableId}`, async () => {
  const [tableResponse] = await Promise.all([
    api<{ table: ITable }>(`/api/tables/${tableId}`),
    fieldsStore.fetchFields(tableId),
  ])
  // Filters decode against field metadata, so these wait rather than running in parallel —
  // otherwise a shared filter URL would render unfiltered on first load.
  await Promise.all([
    recordsStore.fetchRecords(tableId, queryParams.value),
    // A relation filter is a picker over the target's records, so its candidates have to be
    // there on first paint for a shared link to show what it is filtered by
    relationsStore.loadOptions(tableId, fieldsStore.fields),
  ])
  return tableResponse
})

// Every list change goes through the URL, so one watcher covers filtering, sorting and paging
watch(queryParams, (params) => recordsStore.fetchRecords(tableId, params))

if (error.value) {
  throw createError({ statusCode: error.value.statusCode ?? 404, statusMessage: 'Table not found' })
}

const table = computed(() => data.value?.table)
useSeoMeta({ title: () => table.value?.name ?? 'Records' })

const breadcrumbs = computed<IBreadcrumb[]>(() => [
  { label: 'Home', to: '/' },
  { label: table.value?.name ?? 'Table' },
])

const hasFields = computed(() => fieldsStore.fields.length > 0)

const emptyTitle = computed(() => {
  if (!isNarrowed.value) return 'No records yet'
  if (queryParams.value.search && activeFilterCount.value === 0) {
    return `Nothing matches “${queryParams.value.search}”`
  }
  return activeFilterCount.value === 1 && !queryParams.value.search
    ? 'No records match this filter'
    : 'No records match what you are looking for'
})

const emptyMessage = computed(() => {
  if (!isNarrowed.value) return 'Add your first record to see it here.'
  if (queryParams.value.search && activeFilterCount.value === 0) {
    return 'Check the spelling, or try a shorter word.'
  }
  return queryParams.value.search
    ? 'This table has records, but none match both your search and your filters.'
    : 'This table has records, but none match all of these filters at once.'
})

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

/**
 * Below the minimum the term is dropped rather than sent: the schema rejects it anyway, and
 * an unanchored match across every field is not worth running for one character.
 */
function applySearch(next: string) {
  const search = next.trim().length >= SEARCH_MIN_LENGTH ? next.trim() : ''
  if (search === queryParams.value.search) return

  return applyQuery({ ...queryParams.value, page: 1, search }, true)
}

function clearNarrowing() {
  return applyQuery({ ...queryParams.value, page: 1, filters: {}, search: '' }, true)
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

const {
  target: deleteTarget,
  pending: deletePending,
  confirmLabel: deleteLabel,
  confirm: confirmDeleteRecord,
  cancel: cancelDelete,
} = useDeleteConfirm((record: IRecord) =>
  recordsStore.deleteRecord(tableId, record.id, queryParams.value),
)
</script>

<style lang="scss" scoped>
.records-page {
  &__header {
    @include page-header;
  }

  &__title {
    @include page-title;
  }

  &__header-actions {
    display: flex;
    align-items: center;
    gap: rem(16);
  }

  &__link {
    @include text-link;
  }

  &__search {
    width: rem(220);
  }

  // Placement only — BasePagination owns its internal layout
  &__pagination {
    margin-top: rem(12);
  }
}
</style>
