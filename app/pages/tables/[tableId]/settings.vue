<template>
  <div class="table-page">
    <AppBreadcrumbs :items="breadcrumbs" />

    <header class="table-page__header">
      <div class="table-page__heading">
        <h1 class="table-page__title">{{ table?.name }}</h1>
        <!-- Both table screens open with the same name; this line is what says which one -->
        <p class="table-page__subtitle">Table settings</p>
      </div>
      <BaseButton variant="ghost" prepend-icon="mdi:table" :to="`/tables/${tableId}`">
        Records
      </BaseButton>
    </header>

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
          <div class="detail-card__row">
            <dt class="detail-card__term">Created</dt>
            <dd class="detail-card__value">{{ createdAt }}</dd>
          </div>
          <!-- Omitted rather than zeroed: the count comes from the tables store, and
               `ensureTables` fails silently — a 0 here would be a claim, not a reading -->
          <div v-if="recordCount !== null" class="detail-card__row">
            <dt class="detail-card__term">Records</dt>
            <dd class="detail-card__value">{{ recordCount }}</dd>
          </div>
        </dl>

        <!-- Words, not icons: a one-off action in a card footer, the same pair the
             dashboard's table card carries. The repeated row actions below are icons. -->
        <div class="detail-card__actions">
          <BaseButton variant="link" @click="renameOpen = true">Rename</BaseButton>
          <BaseButton variant="link" tone="danger" @click="tableDeleteTarget = tableId">
            Delete table
          </BaseButton>
        </div>
      </div>
    </section>

    <section class="table-page__section">
      <div class="section-head">
        <h2 class="section-head__title">Fields</h2>
        <span v-if="fieldCount > 0" class="section-head__count">{{ fieldCount }}</span>
        <BaseButton class="section-head__action" @click="openCreateField">Add field</BaseButton>
      </div>

      <div class="field-card">
        <BaseEmptyState
          v-if="fieldCount === 0"
          title="No fields yet"
          icon="mdi:view-column-outline"
        >
          Fields decide what each record stores. Add one and it becomes a column here and a question
          on the form.
          <template #action>
            <BaseButton @click="openCreateField">Add field</BaseButton>
          </template>
        </BaseEmptyState>

        <ul v-else class="field-list">
          <li v-for="field in fieldsStore.fields" :key="field.id" class="field-row">
            <div class="field-row__lead">
              <!-- The scannable column. Never without the type's word beside it, below. -->
              <span class="field-row__icon">
                <Icon :name="FIELD_TYPE_ICONS[field.type]" aria-hidden="true" />
              </span>

              <div class="field-row__body">
                <p class="field-row__name">
                  <span class="field-row__label">{{ field.name }}</span>
                  <BaseBadge v-if="field.required" variant="label">required</BaseBadge>
                </p>
                <!-- Type, then how it is configured, then the key it is addressed by. The
                     detail comes from the registry and the cardinality from `isMultiValue`,
                     so nothing here branches on the type itself. -->
                <!-- Every part is an element, never a bare text node: Vue's `condense` drops
                     the whitespace between two elements but keeps a space beside loose text,
                     which would space one separator differently from the next. -->
                <p class="field-row__meta">
                  <span>{{ FIELD_TYPE_LABELS[field.type] }}</span>
                  <template v-if="FIELD_CONFIG_SUMMARIES[field.type]">
                    <span class="field-row__sep" aria-hidden="true">·</span>
                    <component :is="FIELD_CONFIG_SUMMARIES[field.type]" :field="field" />
                  </template>
                  <template v-if="isMultiValue(field)">
                    <span class="field-row__sep" aria-hidden="true">·</span>
                    <span>multiple values</span>
                  </template>
                  <span class="field-row__sep" aria-hidden="true">·</span>
                  <code class="field-row__key">{{ field.key }}</code>
                </p>
              </div>
            </div>

            <div class="field-row__actions">
              <BaseButton
                variant="icon"
                prepend-icon="mdi:pencil-outline"
                :label="`Edit field ${field.name}`"
                @click="openEditField(field)"
              />
              <BaseButton
                variant="icon"
                prepend-icon="mdi:trash-can-outline"
                tone="danger"
                :label="`Delete field ${field.name}`"
                @click="deleteTarget = field"
              />
            </div>
          </li>
        </ul>
      </div>
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
      v-if="fieldModal"
      :mode="fieldModal.mode"
      :field="fieldModal.mode === 'edit' ? fieldModal.field : undefined"
      :submit-handler="submitField"
      @saved="fieldModal = null"
      @close="fieldModal = null"
    />

    <LazyConfirmModal
      v-if="tableDeleteTarget"
      title="Delete table"
      danger
      :pending="tableDeletePending"
      :confirm-label="tableDeleteLabel"
      :error="tableDeleteError"
      @confirm="confirmDeleteTable"
      @close="cancelDeleteTable"
    >
      Delete <strong>{{ table?.name }}</strong
      >? All of its fields and records will be permanently removed. This cannot be undone.
    </LazyConfirmModal>

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
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { createError, navigateTo, useAsyncData, useRoute, useSeoMeta } from '#imports'
import { useApi } from '~/composables/useApi'
import { useDeleteConfirm } from '~/composables/useDeleteConfirm'
import { useFieldsStore } from '~/stores/fields'
import { useTablesStore } from '~/stores/tables'
import { toPageError } from '~/utils/api-error'
import { formatNumber, formatTimestamp } from '~/utils/format'
import { FIELD_CONFIG_SUMMARIES } from '~/field-types/config-summaries'
import { FIELD_TYPE_ICONS } from '~/field-types/icons'
import { FIELD_TYPE_LABELS } from '#shared/constants/field'
import { isMultiValue } from '#shared/utils/field'
import type { IBreadcrumb } from '~/types/breadcrumb'
import type { ITable } from '#shared/types/table'
import type { IField } from '#shared/types/field'
import type { TFieldInput } from '#shared/validation/field'

type TFieldModal = { mode: 'create' } | { mode: 'edit'; field: IField }

const route = useRoute()
const api = useApi()
const fieldsStore = useFieldsStore()
const tablesStore = useTablesStore()
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

/**
 * The list row for this table, when the layout's `ensureTables` has loaded one. It carries the
 * counts, and it is the copy a rename writes to — `renameTable` updates the store, not this
 * page's `data`, so reading the name from here is what keeps the heading and the breadcrumbs
 * in step without a refetch.
 */
const cachedTableRow = computed(() => tablesStore.tables.find((table) => table.id === tableId))

/**
 * Preferred over the fetched table, and falling back to it: `ensureTables` never throws, so
 * the store may legitimately hold nothing at all and the page must still render.
 */
const table = computed(() => cachedTableRow.value ?? data.value?.table)

useSeoMeta({ title: () => table.value?.name ?? 'Table' })

const breadcrumbs = computed<IBreadcrumb[]>(() => [
  { label: 'Home', to: '/' },
  { label: table.value?.name ?? 'Table', to: `/tables/${tableId}` },
  { label: 'Settings' },
])

const createdAt = computed(() => (table.value ? formatTimestamp(table.value.createdAt) : ''))

/** `null` when the store has no row for this table — see the template. */
const recordCount = computed(() =>
  cachedTableRow.value ? formatNumber(cachedTableRow.value._count.records) : null,
)

const fieldCount = computed(() => fieldsStore.fields.length)

const renameOpen = ref(false)

// Throws (409 on a duplicate name) propagate into TableFormModal's useForm, which shows the error
async function submitRename(name: string) {
  await tablesStore.renameTable(tableId, { name })
}

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

/**
 * Deleting the table leaves nowhere to stand, so the navigation is part of the removal rather
 * than something that follows it. A refusal — another table's RELATION points here — is caught
 * by the composable and rendered in the dialog, which is why nothing is rethrown.
 */
const {
  target: tableDeleteTarget,
  pending: tableDeletePending,
  error: tableDeleteError,
  confirmLabel: tableDeleteLabel,
  confirm: confirmDeleteTable,
  cancel: cancelDeleteTable,
} = useDeleteConfirm(async (id: string) => {
  await tablesStore.deleteTable(id)
  await navigateTo('/')
})

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
  @include stack(24);

  &__header {
    @include page-header;

    // The stack above already spaces the sections; `page-header` carries its own bottom
    // margin for pages that do not stack, and here the two would compound.
    margin-bottom: 0;
  }

  // `min-width: 0` — the group, not the `<h1>`, is the header's flex item. See the records
  // page and `docs/decisions.md`.
  &__heading {
    min-width: 0;
  }

  &__title {
    @include page-title;
  }

  &__subtitle {
    margin: rem(2) 0 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  &__section {
    @include stack(10);
  }
}

.section-head {
  @include cluster(12);

  // Matches a control, so a section with an action and one without line up
  min-height: var(--control-height);

  &__title {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
  }

  &__count {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    font-variant-numeric: tabular-nums;
  }

  // Pushed to the far edge rather than the row being `space-between`: the title, the count
  // and the action are three items, and only the last one belongs on the right.
  &__action {
    margin-left: auto;
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
    // A rule inside a surface, so the softer token — the card's own edge is the structure
    border-bottom: 1px solid var(--color-border-subtle);

    @include below-shell {
      grid-template-columns: minmax(0, 1fr);
      gap: rem(2);
      align-items: start;
      padding-block: rem(10);
    }
  }

  &__term {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  &__value {
    margin: 0;
    min-width: 0;

    @include truncate;
  }

  &__actions {
    @include cluster;

    padding: rem(10) rem(16);
  }
}

.field-card {
  @include surface-card;
}

.field-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.field-row {
  display: flex;
  align-items: center;
  gap: rem(16);
  padding: rem(8) rem(16);
  border-bottom: 1px solid var(--color-border-subtle);

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    // The row wash, not the control hover — the same pairing `DynamicTable` uses
    background: var(--color-surface-row-hover);
  }

  // The icon and the text travel together; on a narrow pane the actions drop below them,
  // so they are one flex item rather than two.
  &__lead {
    display: flex;
    align-items: center;
    gap: rem(16);
    flex: 1;
    min-width: 0;
  }

  // Neutral, not accent-tinted: the section's one blue is spent on "Add field", and six
  // tinted tiles would outrank it.
  &__icon {
    display: grid;
    place-items: center;
    width: rem(32);
    height: rem(32);
    flex: none;
    border-radius: var(--radius-md);
    background: var(--color-surface-muted);
    // An icon glyph size, not a type-scale step — `<Icon>` sizes off `font-size`
    font-size: rem(20);
    color: var(--color-text-secondary);
  }

  &__body {
    flex: 1;
    min-width: 0;
  }

  &__name {
    @include cluster(8);

    margin: 0;
  }

  // The only run at full text colour on the row: it is the one thing the user named
  &__label {
    min-width: 0;
    font-size: var(--font-size-md);
    font-weight: 500;

    @include truncate;
  }

  // Deliberately not a flex row: `truncate` ellipsises a block of inline content, and a
  // flex container would clip its children mid-word instead.
  &__meta {
    margin: rem(2) 0 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);

    @include truncate;

    @include below-shell {
      white-space: normal;
    }
  }

  &__sep {
    margin: 0 rem(6);
    color: var(--color-border-strong);
  }

  // A URL contract rather than a category, so it stops sharing the type's grey
  &__key {
    padding: rem(1) rem(6);
    border-radius: var(--radius-sm);
    background: var(--color-surface-muted);
    font-size: var(--font-size-xs);
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: rem(4);
    flex: none;
  }

  // Below the shell breakpoint the actions take their own line rather than squeezing the
  // name to nothing: two 36px targets and a truncating label cannot share 327px.
  @include below-shell {
    flex-wrap: wrap;
    padding-block: rem(12);

    &__actions {
      flex-basis: 100%;
      // Aligned under the text, not the icon tile
      margin-left: rem(48);
    }
  }
}
</style>
