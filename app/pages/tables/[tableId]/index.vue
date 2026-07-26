<template>
  <section class="table-page">
    <NuxtLink to="/" class="table-page__back">
      <Icon name="mdi:arrow-left" aria-hidden="true" />
      Your tables
    </NuxtLink>

    <header class="table-page__header">
      <h1 class="table-page__title">{{ table?.name }}</h1>
      <div class="table-page__header-actions">
        <NuxtLink :to="`/tables/${tableId}/records`" class="table-page__link">Records</NuxtLink>
        <BaseButton @click="openCreateField">Add field</BaseButton>
      </div>
    </header>

    <p v-if="fieldsStore.fields.length === 0" class="table-page__empty">
      No fields yet — add a field to define this table's structure.
    </p>

    <ul v-else class="field-list">
      <li v-for="field in fieldsStore.fields" :key="field.id" class="field-row">
        <div class="field-row__main">
          <span class="field-row__name">{{ field.name }}</span>
          <BaseBadge v-if="field.required" variant="label">required</BaseBadge>
          <code class="field-row__key">{{ field.key }}</code>
        </div>
        <span class="field-row__type">{{ FIELD_TYPE_LABELS[field.type] }}</span>
        <div class="field-row__actions">
          <button type="button" class="field-row__action" @click="openEditField(field)">
            Edit
          </button>
          <button
            type="button"
            class="field-row__action field-row__action--danger"
            @click="deleteTarget = field"
          >
            Delete
          </button>
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
      :confirm-label="deletePending ? 'Deleting…' : 'Delete'"
      @confirm="confirmDeleteField"
      @close="deleteTarget = null"
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
import { useFieldsStore } from '~/stores/fields'
import { FIELD_TYPE_LABELS } from '#shared/types/field'
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

const deleteTarget = ref<IField | null>(null)
const deletePending = ref(false)

async function confirmDeleteField() {
  if (!deleteTarget.value) return
  deletePending.value = true
  try {
    await fieldsStore.deleteField(tableId, deleteTarget.value.id)
    deleteTarget.value = null
  } finally {
    deletePending.value = false
  }
}
</script>

<style lang="scss" scoped>
.table-page {
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
}

.field-list {
  display: flex;
  flex-direction: column;
  gap: rem(8);
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
  border-radius: rem(8);
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
    font-size: rem(12);
    color: var(--color-text-muted);
  }

  &__type {
    font-size: rem(13);
    color: var(--color-text-muted);
  }

  &__actions {
    display: flex;
    gap: rem(12);
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
