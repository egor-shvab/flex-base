<template>
  <section class="table-page">
    <AppBreadcrumbs :items="breadcrumbs" />

    <header class="table-page__header">
      <h1 class="table-page__title">{{ table?.name }}</h1>
      <div class="table-page__header-actions">
        <NuxtLink :to="`/tables/${tableId}/records`" class="table-page__link">Records</NuxtLink>
        <BaseButton @click="openCreateField">Add field</BaseButton>
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
          <BaseButton
            variant="link"
            hover-color="var(--color-danger)"
            @click="deleteTarget = field"
          >
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
      @confirm="confirmDeleteField"
      @close="cancelDelete"
    >
      Delete <strong>{{ deleteTarget.name }}</strong
      >? This removes the field from the table.
    </LazyConfirmModal>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { createError, useAsyncData, useRoute, useSeoMeta } from '#imports'
import { useApi } from '~/composables/useApi'
import { useDeleteConfirm } from '~/composables/useDeleteConfirm'
import { useFieldsStore } from '~/stores/fields'
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
  throw createError({ statusCode: error.value.statusCode ?? 404, statusMessage: 'Table not found' })
}

const table = computed(() => data.value?.table)
useSeoMeta({ title: () => table.value?.name ?? 'Table' })

const breadcrumbs = computed<IBreadcrumb[]>(() => [
  { label: 'Home', to: '/' },
  { label: table.value?.name ?? 'Table', to: `/tables/${tableId}/records` },
  { label: 'Fields' },
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
}

.field-list {
  @include stack(8);

  margin: 0;
  padding: 0;
  list-style: none;
}

.field-row {
  display: flex;
  align-items: center;
  gap: rem(16);
  padding: rem(12) rem(16);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);

  &__main {
    display: flex;
    align-items: center;
    gap: rem(8);
    flex: 1;
    min-width: 0;
  }

  &__name {
    font-size: rem(15);
    font-weight: 500;
  }

  &__key {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
  }

  &__type {
    font-size: rem(13);
    color: var(--color-text-secondary);
  }

  &__actions {
    display: flex;
    gap: rem(12);
  }
}
</style>
