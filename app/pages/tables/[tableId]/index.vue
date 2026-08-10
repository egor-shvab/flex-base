<template>
  <section class="table-page">
    <AppBreadcrumbs :items="breadcrumbs" />

    <header class="table-page__header">
      <div class="table-page__header-main">
        <h1 class="table-page__title">{{ table?.name }}</h1>
        <BaseButton class="table-page__create" @click="openCreateField">Add field</BaseButton>
      </div>
      <div class="table-page__header-actions">
        <BaseButton variant="ghost" icon="mdi:table" :to="`/tables/${tableId}/records`">
          Records
        </BaseButton>
      </div>
    </header>

    <BaseEmptyState v-if="fieldsStore.fields.length === 0" title="No fields yet">
      Fields decide what each record stores. Add one and it becomes a column here and a question on
      the form.
      <template #action>
        <BaseButton @click="openCreateField">Add field</BaseButton>
      </template>
    </BaseEmptyState>

    <ul v-else class="field-list">
      <li v-for="field in fieldsStore.fields" :key="field.id" class="field-row">
        <div class="field-row__main">
          <span class="field-row__name">{{ field.name }}</span>
          <BaseBadge v-if="field.required" variant="label">required</BaseBadge>
          <code class="field-row__key">{{ field.key }}</code>
        </div>
        <span class="field-row__type">{{ FIELD_TYPE_LABELS[field.type] }}</span>
        <div class="field-row__actions">
          <BaseButton variant="link" @click="openEditField(field)">Edit</BaseButton>
          <BaseButton variant="link" tone="danger" @click="deleteTarget = field">
            Delete
          </BaseButton>
        </div>
      </li>
    </ul>

    <LazyFieldFormModal
      v-if="fieldModal"
      :mode="fieldModal.mode"
      :field="fieldModal.mode === 'edit' ? fieldModal.field : undefined"
      :submit-handler="submitField"
      @saved="fieldModal = null"
      @close="fieldModal = null"
    />

    <LazyConfirmModal
      v-if="deleteTarget"
      title="Delete field"
      danger
      :pending="deletePending"
      :confirm-label="deleteLabel"
      :error="deleteError"
      @confirm="confirmDeleteField"
      @close="cancelDelete"
    >
      Delete <strong>{{ deleteTarget.name }}</strong
      >? Everything stored in this field will be permanently removed from every record. This cannot
      be undone.
    </LazyConfirmModal>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { createError, useAsyncData, useRoute, useSeoMeta } from '#imports'
import { useApi } from '~/composables/useApi'
import { useDeleteConfirm } from '~/composables/useDeleteConfirm'
import { useFieldsStore } from '~/stores/fields'
import { toPageError } from '~/utils/api-error'
import { FIELD_TYPE_LABELS } from '#shared/constants/field'
import type { IBreadcrumb } from '~/types/breadcrumb'
import type { ITable } from '#shared/types/table'
import type { IField } from '#shared/types/field'
import type { TFieldInput } from '#shared/validation/field'

type TFieldModal = { mode: 'create' } | { mode: 'edit'; field: IField }

const route = useRoute()
const api = useApi()
const fieldsStore = useFieldsStore()
const tableId = route.params.tableId as string

const { data, error } = await useAsyncData(`table-${tableId}`, async () => {
  const [tableResponse] = await Promise.all([
    api<{ table: ITable }>(`/api/tables/${tableId}`),
    fieldsStore.fetchFields(tableId),
  ])
  return tableResponse
})

if (error.value) {
  throw createError(toPageError(error.value))
}

const table = computed(() => data.value?.table)
useSeoMeta({ title: () => table.value?.name ?? 'Table' })

const breadcrumbs = computed<IBreadcrumb[]>(() => [
  { label: 'Home', to: '/' },
  { label: table.value?.name ?? 'Table', to: `/tables/${tableId}/records` },
  { label: 'Settings' },
])

const fieldModal = ref<TFieldModal | null>(null)

function openCreateField() {
  fieldModal.value = { mode: 'create' }
}

function openEditField(field: IField) {
  fieldModal.value = { mode: 'edit', field }
}

// Throws (400/409) propagate into FieldFormModal's useForm, which shows the error
async function submitField(input: TFieldInput) {
  if (fieldModal.value?.mode === 'edit') {
    await fieldsStore.updateField(tableId, fieldModal.value.field.id, input)
  } else {
    await fieldsStore.createField(tableId, input)
  }
}

const {
  target: deleteTarget,
  pending: deletePending,
  error: deleteError,
  confirmLabel: deleteLabel,
  confirm: confirmDeleteField,
  cancel: cancelDelete,
} = useDeleteConfirm((field: IField) => fieldsStore.deleteField(tableId, field.id))
</script>

<style lang="scss" scoped>
.table-page {
  &__header {
    @include page-header;
  }

  // `min-width: 0` — the group, not the `<h1>`, is the header's flex item. See the records
  // page and `docs/decisions.md`.
  &__header-main {
    @include cluster;

    min-width: 0;
  }

  &__title {
    @include page-title;
  }

  &__create {
    flex: none;
  }

  &__header-actions {
    @include cluster;
  }
}

.field-list {
  @include stack(8);

  margin: 0;
  padding: 0;
  list-style: none;
}

.field-row {
  @include cluster;

  padding: rem(12) rem(16);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);

  &__main {
    @include cluster(8);

    flex: 1;
    min-width: 0;
  }

  &__name {
    font-size: var(--font-size-md);
    font-weight: 500;
  }

  &__key {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
  }

  &__type {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  &__actions {
    display: flex;
    gap: rem(12);
  }
}
</style>
