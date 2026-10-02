<template>
  <div class="table-page">
    <div class="table-page__top">
      <div class="table-page__crumbs">
        <BaseBreadcrumbs :items="breadcrumbs" />
        <BaseButton
          variant="ghost"
          prepend-icon="material-symbols:table-outline-rounded"
          :to="`/tables/${tableAddress}`"
        >
          Records
        </BaseButton>
      </div>

      <div class="table-page__title-row">
        <h1 class="table-page__title">{{ table?.name }}</h1>
        <BaseButton
          class="table-page__create"
          prepend-icon="material-symbols:add-rounded"
          @click="openCreateField"
        >
          Add field
        </BaseButton>
      </div>

      <p class="table-page__eyebrow">Table settings</p>
    </div>

    <section class="table-page__section">
      <div class="section-head">
        <h2 class="section-head__title">Table</h2>
      </div>

      <div class="detail-card">
        <dl class="detail-card__list">
          <div class="detail-card__row">
            <dt class="detail-card__term">Name</dt>
            <dd class="detail-card__value">{{ table?.name }}</dd>
          </div>
          <div v-if="recordCount !== null" class="detail-card__row">
            <dt class="detail-card__term">Records</dt>
            <dd class="detail-card__value detail-card__value--mono">{{ recordCount }}</dd>
          </div>
          <div class="detail-card__row">
            <dt class="detail-card__term">Fields</dt>
            <dd class="detail-card__value detail-card__value--mono">{{ fieldCount }}</dd>
          </div>
          <div class="detail-card__row">
            <dt class="detail-card__term">Created</dt>
            <dd class="detail-card__value">{{ createdAt }}</dd>
          </div>
          <div v-if="address" class="detail-card__row">
            <dt class="detail-card__term">Address</dt>
            <dd class="detail-card__value detail-card__value--address">{{ address }}</dd>
          </div>
        </dl>

        <div class="detail-card__actions">
          <BaseButton variant="link" @click="renameOpen = true">Rename</BaseButton>
          <BaseButton variant="link" tone="danger" @click="tableDeleteTarget = tableAddress">
            Delete table
          </BaseButton>
        </div>
      </div>
    </section>

    <section class="table-page__section">
      <div class="section-head">
        <h2 class="section-head__title">Fields</h2>
        <span v-if="fieldCount > 0" class="section-head__count">{{ fieldCount }}</span>
      </div>

      <TableFieldList
        :fields="fieldsStore.fields"
        :summary-context="summaryContext"
        @create="openCreateField"
        @edit="openEditField"
        @delete="fieldDeleteTarget = $event"
      />
    </section>

    <LazyTableFormModal
      v-if="renameOpen"
      mode="rename"
      :initial-name="table?.name ?? ''"
      :submit-handler="submitRename"
      @saved="renameOpen = false"
      @close="renameOpen = false"
    />

    <LazyFieldFormModal
      v-if="fieldModalOpen"
      :mode="editingField ? 'edit' : 'create'"
      :field="editingField"
      :submit-handler="submitField"
      @saved="closeFieldModal"
      @close="closeFieldModal"
    />

    <LazyConfirmModal
      v-if="tableDeleteTarget"
      title="Delete table"
      danger
      v-bind="tableDeleteDialog"
      @confirm="confirmDeleteTable"
      @close="cancelDeleteTable"
    >
      Delete <strong>{{ table?.name }}</strong
      >? All of its fields and records will be permanently removed. This cannot be undone.
    </LazyConfirmModal>

    <LazyConfirmModal
      v-if="fieldDeleteTarget"
      title="Delete field"
      danger
      v-bind="fieldDeleteDialog"
      @confirm="confirmDeleteField"
      @close="cancelDeleteField"
    >
      Delete <strong>{{ fieldDeleteTarget.name }}</strong
      >? Everything stored in this field will be permanently removed from every record. This cannot
      be undone.
    </LazyConfirmModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { createError, navigateTo, useAsyncData, useRoute, useSeoMeta } from '#imports'
import { useDeleteConfirm } from '~/composables/useDeleteConfirm'
import { useEntityFormModal } from '~/composables/useEntityFormModal'
import { useTableLoader } from '~/composables/useTableLoader'
import { useFieldsStore } from '~/stores/fields'
import { useTablesStore } from '~/stores/tables'
import type { IFieldConfigSummaryContext } from '~/field-types/types'
import { toPageError } from '~/utils/api-error'
import { formatNumber, formatTimestamp } from '~/utils/format'
import type { IBreadcrumb } from '~/types/breadcrumb'
import type { IField } from '#shared/types/field'
import type { TFieldInput } from '#shared/validation/field'
import { toTableAddress } from '#shared/utils/address'

const route = useRoute()
const loadTable = useTableLoader()
const fieldsStore = useFieldsStore()
const tablesStore = useTablesStore()
const tableAddress = route.params.tableAddress as string

const { data, error } = await useAsyncData(`table-${tableAddress}`, () => loadTable(tableAddress))

if (error.value) {
  throw createError(toPageError(error.value))
}

const cachedTableRow = computed(() => tablesStore.tableRow(tableAddress))

const table = computed(() => cachedTableRow.value ?? data.value)

useSeoMeta({ title: () => table.value?.name ?? 'Table' })

const breadcrumbs = computed<IBreadcrumb[]>(() => [
  { label: 'Home', to: '/' },
  { label: table.value?.name ?? 'Table', to: `/tables/${tableAddress}` },
  { label: 'Settings' },
])

const createdAt = computed(() => (table.value ? formatTimestamp(table.value.createdAt) : ''))

const recordCount = computed(() =>
  cachedTableRow.value ? formatNumber(cachedTableRow.value._count.records) : null,
)

const fieldCount = computed(() => fieldsStore.fields.length)

const address = computed(() => (table.value ? `/tables/${toTableAddress(table.value)}` : ''))

/** A plain object, not a computed: `tableName` is called during render, so `tables` is tracked. */
const summaryContext: IFieldConfigSummaryContext = {
  tableName: (id) => tablesStore.tableRow(id)?.name,
}

const renameOpen = ref(false)

async function submitRename(name: string) {
  await tablesStore.renameTable(tableAddress, { name })
}

const {
  open: fieldModalOpen,
  editing: editingField,
  openCreate: openCreateField,
  openEdit: openEditField,
  close: closeFieldModal,
} = useEntityFormModal<IField>()

async function submitField(input: TFieldInput) {
  if (editingField.value) {
    await fieldsStore.updateField(tableAddress, editingField.value.id, input)
  } else {
    await fieldsStore.createField(tableAddress, input)
  }
}

const {
  target: tableDeleteTarget,
  dialogProps: tableDeleteDialog,
  confirm: confirmDeleteTable,
  cancel: cancelDeleteTable,
} = useDeleteConfirm(async (id: string) => {
  await tablesStore.deleteTable(id)
  await navigateTo('/')
})

const {
  target: fieldDeleteTarget,
  dialogProps: fieldDeleteDialog,
  confirm: confirmDeleteField,
  cancel: cancelDeleteField,
} = useDeleteConfirm((field: IField) => fieldsStore.deleteField(tableAddress, field.id))
</script>

<style lang="scss" scoped>
.table-page {
  @include stack(24);

  max-width: rem(928);

  &__top {
    @include stack(14);
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

  &__eyebrow {
    @include eyebrow;

    margin: 0;
  }

  &__section {
    @include stack(10);
  }
}

.section-head {
  @include cluster(12);

  min-height: var(--control-height);

  &__title {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
  }

  &__count {
    font-family: var(--font-mono);
    font-size: var(--font-size-md);
    color: var(--color-text-subtle);
  }
}

.detail-card {
  @include surface-card;

  &__list {
    margin: 0;
  }

  &__row {
    display: grid;
    grid-template-columns: rem(160) minmax(0, 1fr);
    gap: rem(16);
    align-items: center;
    min-height: rem(44);
    padding: rem(8) rem(16);
    border-bottom: 1px solid var(--color-border-subtle);

    @include below-shell {
      grid-template-columns: minmax(0, 1fr);
      gap: rem(2);
      align-items: start;
      padding-block: rem(10);
    }
  }

  &__term {
    font-size: var(--font-size-md);
    color: var(--color-text-secondary);
  }

  &__value {
    margin: 0;
    min-width: 0;

    @include truncate;

    &--mono {
      font-family: var(--font-mono);
      font-size: var(--font-size-md);
    }

    &--address {
      font-family: var(--font-mono);
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
    }
  }

  &__actions {
    @include cluster;

    padding: rem(10) rem(16);
  }
}
</style>
