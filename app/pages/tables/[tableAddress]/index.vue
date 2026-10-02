<template>
  <section class="records-page">
    <div class="records-page__top">
      <div class="records-page__crumbs">
        <BaseBreadcrumbs :items="breadcrumbs" />
        <BaseButton
          variant="ghost"
          prepend-icon="material-symbols:settings-outline-rounded"
          :to="`/tables/${tableAddress}/settings`"
        >
          Settings
        </BaseButton>
      </div>

      <header class="records-page__title-row">
        <h1 class="records-page__title">{{ table?.name }}</h1>
        <BaseButton
          class="records-page__create"
          prepend-icon="material-symbols:add-rounded"
          :disabled="!hasFields"
          @click="openCreateRecord"
        >
          Add record
        </BaseButton>
      </header>

      <div v-if="hasFields" class="records-page__toolbar">
        <BaseInput
          id="records-search"
          class="records-page__search"
          :model-value="queryState.search"
          type="text"
          icon="material-symbols:search-rounded"
          aria-label="Search this table"
          placeholder="Search records"
          trim
          :debounce="QUERY_DEBOUNCE_MS"
          @update:model-value="applySearch"
        />
        <BaseButton
          variant="ghost"
          prepend-icon="material-symbols:filter-list-rounded"
          :selected="activeFilterCount > 0"
          @click="filterPanelOpen = true"
        >
          Filters
          <span v-if="activeFilterCount > 0" class="records-page__filter-count">{{
            activeFilterCount
          }}</span>
        </BaseButton>
      </div>
    </div>

    <RecordsFilterSummary
      v-if="hasFields && isNarrowed"
      :fields="fieldsStore.fields"
      :filters="filters"
      :search="queryState.search"
      :total="recordsStore.total"
      :total-capped="recordsStore.totalCapped"
      :pending="recordsStore.pending"
      @update:filters="applyFilters"
      @update:search="applySearch"
      @clear="clearNarrowing"
    />

    <BaseErrorBanner v-if="recordsStore.failed" class="records-page__failed">
      That view couldn’t be loaded. Check the web address, or
      <NuxtLink :to="`/tables/${tableAddress}`" class="text-link"
        >start again with all records</NuxtLink
      >.
    </BaseErrorBanner>

    <div class="records-page__body">
      <RecordsTableSkeleton v-if="rowsLoading" class="records-page__skeleton" />

      <BaseEmptyState
        v-else-if="!hasFields"
        class="records-page__empty"
        icon="material-symbols:view-column-outline-rounded"
      >
        This table has no fields yet —
        <NuxtLink :to="`/tables/${tableAddress}/settings`" class="text-link"
          >define its fields</NuxtLink
        >
        before adding records.
      </BaseEmptyState>

      <template v-else>
        <BaseEmptyState
          v-if="recordsStore.records.length === 0 && !recordsStore.failed"
          class="records-page__empty"
          role="status"
          :title="emptyTitle"
          :icon="emptyIcon"
        >
          {{ emptyMessage }}
          <template #action>
            <BaseButton v-if="isNarrowed" @click="clearNarrowing">Show all records</BaseButton>
            <BaseButton v-else @click="openCreateRecord">Add record</BaseButton>
          </template>
        </BaseEmptyState>

        <template v-else>
          <RecordsTable
            class="records-page__table"
            :table-number="tableNumber"
            :fields="fieldsStore.fields"
            :records="recordsStore.records"
            :sort="queryState.sort"
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
            :total-capped="recordsStore.totalCapped"
            :has-next="recordsStore.hasNextPage"
            @update:page="goToPage"
          />
        </template>
      </template>
    </div>

    <LazyRecordsFilterPanel
      v-if="filterPanelOpen"
      :fields="fieldsStore.fields"
      :filters="filters"
      :total="recordsStore.total"
      :total-capped="recordsStore.totalCapped"
      :pending="recordsStore.pending"
      @update:filters="applyFilters"
      @close="filterPanelOpen = false"
    />

    <LazyRecordFormModal
      v-if="recordModalOpen"
      :mode="editingRecord ? 'edit' : 'create'"
      :fields="fieldsStore.fields"
      :record="editingRecord"
      :submit-handler="submitRecord"
      @saved="closeRecordModal"
      @close="closeRecordModal"
    />

    <LazyRecordDetailModal
      v-if="detailChain.length > 0"
      :detail="detail"
      :pending="detailPending"
      :error-message="detailError"
      :can-retry="detailCanRetry"
      :current-table-number="tableNumber"
      :back-to="detailBackTo"
      @retry="refreshDetail"
      @close="closeDetail"
    />

    <LazyConfirmModal
      v-if="deleteTarget"
      title="Delete record"
      danger
      v-bind="deleteDialog"
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
import { QUERY_DEBOUNCE_MS } from '~/composables/useDebouncedModel'
import { useDeleteConfirm } from '~/composables/useDeleteConfirm'
import { useEntityFormModal } from '~/composables/useEntityFormModal'
import { useRecordDetail } from '~/composables/useRecordDetail'
import { useRecordListQuery } from '~/composables/useRecordListQuery'
import { useTableLoader } from '~/composables/useTableLoader'
import { useFieldsStore } from '~/stores/fields'
import { useRecordsStore } from '~/stores/records'
import { useRelationsStore } from '~/stores/relations'
import { parseTableAddress } from '#shared/utils/address'
import { toPageError } from '~/utils/api-error'
import type { IBreadcrumb } from '~/types/breadcrumb'
import type { IRecord, TRecordData } from '#shared/types/record'

const route = useRoute()
const loadTable = useTableLoader()
const fieldsStore = useFieldsStore()
const recordsStore = useRecordsStore()
const relationsStore = useRelationsStore()
const tableAddress = route.params.tableAddress as string

const {
  queryState,
  filters,
  activeFilterCount,
  isNarrowed,
  emptyTitle,
  emptyMessage,
  emptyIcon,
  queryKey,
  goToPage,
  applySort,
  applyFilters,
  applySearch,
  clearNarrowing,
} = useRecordListQuery({ fields: () => fieldsStore.fields })

const { data, error } = await useAsyncData(`table-records-${tableAddress}`, async () => {
  const table = await loadTable(tableAddress)
  await Promise.all([
    recordsStore.fetchRecords(tableAddress, queryState.value),
    relationsStore.loadOptions(tableAddress, fieldsStore.fields),
  ])
  return table
})

// Swallowed deliberately: the store sets `failed`, which the template shows; out of a watcher a
// rejection would be unhandled
watch(queryKey, async () => {
  try {
    await recordsStore.fetchRecords(tableAddress, queryState.value)
  } catch {
    // surfaced through `recordsStore.failed`
  }
})

if (error.value) {
  throw createError(toPageError(error.value))
}

const table = computed(() => data.value)

const tableNumber = computed(() => table.value?.number ?? parseTableAddress(tableAddress))
useSeoMeta({ title: () => table.value?.name ?? 'Records' })

const breadcrumbs = computed<IBreadcrumb[]>(() => [
  { label: 'Home', to: '/' },
  { label: table.value?.name ?? 'Table' },
])

const hasFields = computed(() => fieldsStore.fields.length > 0)

const rowsLoading = computed(() => recordsStore.pending && recordsStore.records.length === 0)

const filterPanelOpen = ref(false)

const {
  open: recordModalOpen,
  editing: editingRecord,
  openCreate: openCreateRecord,
  openEdit: openEditRecord,
  close: closeRecordModal,
} = useEntityFormModal<IRecord>()

async function submitRecord(data: TRecordData) {
  if (editingRecord.value) {
    await recordsStore.updateRecord(tableAddress, editingRecord.value.id, data, queryState.value)
    return
  }

  const nextPage = await recordsStore.createRecord(tableAddress, data, queryState.value)
  if (nextPage !== queryState.value.page) {
    await goToPage(nextPage, true)
  }
}

const {
  chain: detailChain,
  detail,
  pending: detailPending,
  errorMessage: detailError,
  canRetry: detailCanRetry,
  backTo: detailBackTo,
  refresh: refreshDetail,
  closeTo: detailCloseTo,
} = useRecordDetail()

function closeDetail() {
  return navigateTo(detailCloseTo.value)
}

const {
  target: deleteTarget,
  dialogProps: deleteDialog,
  confirm: confirmDeleteRecord,
  cancel: cancelDelete,
} = useDeleteConfirm((record: IRecord) =>
  recordsStore.deleteRecord(tableAddress, record.id, queryState.value),
)
</script>

<style lang="scss" scoped>
.records-page {
  display: flex;
  flex-direction: column;
  height: 100%;

  &__top {
    @include stack(14);

    flex: none;
    margin-bottom: rem(20);
  }

  &__crumbs {
    @include page-crumbs;
  }

  &__title-row {
    @include page-title-row;
  }

  &__title {
    @include page-title;
  }

  &__create {
    flex: none;
  }

  &__toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: rem(10);
  }

  &__search {
    flex: 1 1 rem(160);
    min-width: 0;
    max-width: rem(300);
  }

  &__filter-count {
    display: inline-grid;
    place-items: center;
    min-width: rem(18);
    height: rem(18);
    padding: 0 rem(4);
    border-radius: var(--radius-pill);
    background: var(--color-accent);
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    line-height: 1;
    color: var(--color-text-on-accent);
  }

  &__failed {
    margin-bottom: rem(16);
  }

  &__body {
    display: flex;
    flex-direction: column;
    // `min-height: 0`, or the item's automatic minimum is the whole table and it never scrolls
    flex: 1;
    min-height: 0;
  }

  &__table {
    flex: 0 1 auto;
    min-height: 0;
  }

  &__skeleton {
    flex: none;
  }

  &__body &__empty {
    margin-block: auto;
  }

  &__pagination {
    flex: none;
    margin-top: rem(12);
  }
}
</style>
