<template>
  <section class="records-page">
    <AppBreadcrumbs :items="breadcrumbs" />

    <header class="records-page__header">
      <div class="records-page__header-main">
        <h1 class="records-page__title">{{ table?.name }}</h1>
        <BaseButton class="records-page__create" :disabled="!hasFields" @click="openCreateRecord">
          Add record
        </BaseButton>
      </div>
      <div class="records-page__header-actions">
        <div class="records-page__header-buttons">
          <BaseButton
            variant="ghost"
            prepend-icon="mdi:cog-outline"
            :to="`/tables/${tableId}/settings`"
          >
            Settings
          </BaseButton>
          <BaseButton
            v-if="hasFields"
            variant="ghost"
            prepend-icon="mdi:filter-variant"
            @click="filterPanelOpen = true"
          >
            Filters
          </BaseButton>
        </div>
        <BaseInput
          v-if="hasFields"
          id="records-search"
          class="records-page__search"
          :model-value="queryState.search"
          type="text"
          icon="mdi:magnify"
          aria-label="Search this table"
          placeholder="Search…"
          trim
          :debounce="QUERY_DEBOUNCE_MS"
          @update:model-value="applySearch"
        />
      </div>
    </header>

    <!-- The active filters are stated above the data rather than hidden behind the
         drawer that covers it -->
    <RecordsFilterSummary
      v-if="hasFields && isNarrowed"
      :fields="fieldsStore.fields"
      :filters="filters"
      :search="queryState.search"
      :total="recordsStore.total"
      :pending="recordsStore.pending"
      @update:filters="applyFilters"
      @update:search="applySearch"
      @clear="clearNarrowing"
    />

    <p v-if="recordsStore.failed" class="records-page__failed" role="alert">
      That view couldn’t be loaded. Check the web address, or
      <NuxtLink :to="`/tables/${tableId}`" class="text-link">start again with all records</NuxtLink
      >.
    </p>

    <!-- Everything above this is the fixed band; the rows below are the only thing that scrolls -->
    <div class="records-page__body">
      <!-- Ahead of the fieldless state below, not only of the empty one: leaving a table that has
           no fields would otherwise keep claiming that about the table being fetched, and the two
           are the same mistake. A fieldless table at rest is not pending, so it still says so. -->
      <RecordsTableSkeleton v-if="rowsLoading" class="records-page__skeleton" />

      <BaseEmptyState
        v-else-if="!hasFields"
        class="records-page__empty"
        icon="mdi:view-column-outline"
      >
        This table has no fields yet —
        <NuxtLink :to="`/tables/${tableId}/settings`" class="text-link">define its fields</NuxtLink>
        before adding records.
      </BaseEmptyState>

      <template v-else>
        <!-- Not when the load failed: an empty result and an unknown result look the same in
             the store, and claiming the table is empty would be a guess -->
        <!--
          A status, unlike the fieldless state above it: this one appears and changes in
          answer to a filter or a search, with focus still in the box that caused it, so
          nothing else on screen would tell a screen-reader user the table just emptied.
        -->
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
          <DynamicTable
            class="records-page__table"
            :table-id="tableId"
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

    <LazyRecordDetailModal
      v-if="detailChain.length > 0"
      :detail="detail"
      :pending="detailPending"
      :error-message="detailError"
      :can-retry="detailCanRetry"
      :current-table-id="tableId"
      :back-to="detailBackTo"
      @retry="refreshDetail"
      @close="closeDetail"
    />

    <LazyConfirmModal
      v-if="deleteTarget"
      title="Delete record"
      danger
      :pending="deletePending"
      :confirm-label="deleteLabel"
      :error="deleteError"
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
import { QUERY_DEBOUNCE_MS } from '~/composables/useDebouncedModel'
import { useDeleteConfirm } from '~/composables/useDeleteConfirm'
import { useRecordDetail } from '~/composables/useRecordDetail'
import { useRecordListQuery } from '~/composables/useRecordListQuery'
import { useFieldsStore } from '~/stores/fields'
import { useRecordsStore } from '~/stores/records'
import { useRelationsStore } from '~/stores/relations'
import { toPageError } from '~/utils/api-error'
import type { IBreadcrumb } from '~/types/breadcrumb'
import type { ITable } from '#shared/types/table'
import type { IRecord, TRecordData } from '#shared/types/record'

type TRecordModal = { mode: 'create' } | { mode: 'edit'; record: IRecord }

const route = useRoute()
const api = useApi()
const fieldsStore = useFieldsStore()
const recordsStore = useRecordsStore()
const relationsStore = useRelationsStore()
const tableId = route.params.tableId as string

/** The URL is the source of truth for the list query, so a filtered view is shareable. */
const {
  queryState,
  filters,
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

const { data, error } = await useAsyncData(`table-records-${tableId}`, async () => {
  const [tableResponse] = await Promise.all([
    api<{ table: ITable }>(`/api/tables/${tableId}`),
    fieldsStore.fetchFields(tableId),
  ])
  // Filters decode against field metadata, so these wait rather than running in parallel —
  // otherwise a shared filter URL would render unfiltered on first load.
  await Promise.all([
    recordsStore.fetchRecords(tableId, queryState.value),
    // A relation filter is a picker over the target's records, so its candidates have to be
    // there on first paint for a shared link to show what it is filtered by
    relationsStore.loadOptions(tableId, fieldsStore.fields),
  ])
  return tableResponse
})

// Every list change goes through the URL, so one watcher covers filtering, sorting and paging.
// The rejection is swallowed deliberately: the store sets `failed`, which the template shows —
// letting it escape a watcher would be an unhandled rejection and the table would silently keep
// rows that no longer match the URL.
watch(queryKey, async () => {
  try {
    await recordsStore.fetchRecords(tableId, queryState.value)
  } catch {
    // surfaced through `recordsStore.failed`
  }
})

if (error.value) {
  throw createError(toPageError(error.value))
}

const table = computed(() => data.value?.table)
useSeoMeta({ title: () => table.value?.name ?? 'Records' })

const breadcrumbs = computed<IBreadcrumb[]>(() => [
  { label: 'Home', to: '/' },
  { label: table.value?.name ?? 'Table' },
])

const hasFields = computed(() => fieldsStore.fields.length > 0)

/**
 * Loading is its own state, and both halves of this are needed. The store drops the previous
 * table's rows *before* requesting the next one's — and this page is still the one on screen until
 * the incoming one resolves — so between the two there is nothing here to tell "empty" from "not
 * known yet", exactly as `failed` cannot be told from empty. The row count is what keeps it to a
 * body with nothing to draw: an in-place refetch keeps its rows and says "Filtering…" instead.
 */
const rowsLoading = computed(() => recordsStore.pending && recordsStore.records.length === 0)

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
    await recordsStore.updateRecord(tableId, recordModal.value.record.id, data, queryState.value)
    return
  }

  // A new record lands on page 1 of the default view; keep the URL in step rather than
  // letting the store show a page the address bar disagrees with
  const nextPage = await recordsStore.createRecord(tableId, data, queryState.value)
  if (nextPage !== queryState.value.page) {
    await goToPage(nextPage, true)
  }
}

/**
 * The linked-record dialog is URL state exactly as the list query is, so it is read back from
 * the route rather than held here — and closing it is a navigation, not a state change.
 */
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
  pending: deletePending,
  error: deleteError,
  confirmLabel: deleteLabel,
  confirm: confirmDeleteRecord,
  cancel: cancelDelete,
} = useDeleteConfirm((record: IRecord) =>
  recordsStore.deleteRecord(tableId, record.id, queryState.value),
)
</script>

<style lang="scss" scoped>
.records-page {
  // Fills the shell's main pane exactly, so the header, the active filters and the pager
  // stay in place while the rows move
  display: flex;
  flex-direction: column;
  height: 100%;

  &__header {
    @include page-header;
  }

  // The title and its primary action travel together, so this group — not the `<h1>` — is
  // the header's flex item. `min-width: 0` is what lets `page-title`'s ellipsis engage: a
  // flex item's automatic minimum is its content, and a nowrap heading contributes the
  // whole untruncated table name. See `docs/decisions.md`.
  &__header-main {
    @include cluster;

    min-width: 0;
  }

  &__title {
    @include page-title;
  }

  // `flex: none`, or the group's shrink is split in proportion to base size, the button
  // reaches its min-content and wraps its label onto two lines. The title absorbs it all.
  &__create {
    flex: none;
  }

  &__header-actions {
    @include cluster;
  }

  // A ghost button is `padding: 0 rem(12)` over a transparent background, so its box edge
  // is invisible and that padding reads as part of the gap: at the row's rem(16) these two
  // sit 40px apart optically, against 28px between Filters and the bordered search box.
  // rem(4) plus the two paddings is the same 28. Do not normalise it back to rem(16).
  &__header-buttons {
    @include cluster(4);
  }

  &__search {
    width: rem(220);
  }

  &__failed {
    @include error-banner;

    margin-bottom: rem(16);
  }

  &__body {
    display: flex;
    flex-direction: column;
    // `min-height: 0` — without it the item's automatic minimum is the whole table, so it
    // would never shrink and the table's own `overflow` would stay inert
    flex: 1;
    min-height: 0;
  }

  // Sizes to its rows and stops there; past the pane it shrinks and scrolls inside itself.
  // `flex-basis: auto` is what makes the base size the content height, `flex-grow: 0` what
  // keeps a short result from stretching to the bottom edge. Intrinsic throughout, so it
  // re-resolves on resize — and when the summary or the error banner appears — with no
  // height stated anywhere.
  //
  // `min-height: 0` is belt and braces: a scroll container's automatic minimum is already
  // zero, which is what lets this shrink at all. It would stop the day `overflow` moved off
  // this element.
  &__table {
    flex: 0 1 auto;
    min-height: 0;
  }

  // Where the rows will be, not the middle of the pane like the empty states below: it stands in
  // for the table, so it takes the table's place.
  &__skeleton {
    flex: none;
  }

  // An empty state has no natural place in the flow, so it takes the middle of the pane.
  // `margin` rather than the parent's `justify-content`, which cannot centre this one child
  // without lifting a short grid off the top too. Nested so it outranks `BaseEmptyState`'s
  // own `margin` — flat, the two would tie and stylesheet order would decide.
  &__body &__empty {
    margin-block: auto;
  }

  // Placement only — BasePagination owns its internal layout
  &__pagination {
    flex: none;
    margin-top: rem(12);
  }
}
</style>
