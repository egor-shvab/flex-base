<template>
  <div class="dynamic-table">
    <table class="dynamic-table__table">
      <thead>
        <tr>
          <th
            v-for="column in columns"
            :key="column.key"
            scope="col"
            :aria-sort="ariaSort(column)"
            :class="{ 'dynamic-table__number-head': column.key === RECORD_NUMBER_KEY }"
          >
            <button type="button" class="dynamic-table__sort" @click="emit('sort', column.key)">
              {{ column.name }}
              <Icon
                :name="sortIcon(column)"
                class="dynamic-table__sort-icon"
                :class="{ 'dynamic-table__sort-icon--active': sort?.key === column.key }"
                aria-hidden="true"
              />
            </button>
          </th>
          <th scope="col" class="dynamic-table__actions-head">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="record in records" :key="record.id">
          <td v-for="column in columns" :key="column.key">
            <!-- Blank values are rendered here so no cell component has to handle null -->
            <span v-if="isBlank(cellValue(record, column))" class="dynamic-table__blank">
              Not set
            </span>
            <component
              :is="cellComponent(column)"
              v-else
              :field="column"
              :value="cellValue(record, column)"
            />
          </td>
          <td class="dynamic-table__actions">
            <BaseButton
              variant="icon"
              icon="mdi:pencil-outline"
              label="Edit record"
              @click="emit('edit', record)"
            />
            <BaseButton
              variant="icon"
              icon="mdi:trash-can-outline"
              label="Delete record"
              tone="danger"
              @click="emit('delete', record)"
            />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RECORD_NUMBER_KEY } from '#shared/constants/filter'
import type { IField } from '#shared/types/field'
import type { IRecordSort } from '#shared/types/filter'
import type { IRecord, TRecordValue } from '#shared/types/record'
import { queryFields } from '#shared/utils/filter'
import { FIELD_CELLS } from '~/field-types/cells'
import { RECORD_COLUMNS } from '~/field-types/record-columns'

const props = defineProps<{
  fields: IField[]
  records: IRecord[]
  sort?: IRecordSort | null
}>()

/**
 * The record's own columns bracket the table's fields, and one list drives both the header and
 * the body so the two cannot drift. Each sorts through the same helpers as any other column.
 */
const columns = computed(() => queryFields(props.fields))

const emit = defineEmits<{
  edit: [record: IRecord]
  delete: [record: IRecord]
  sort: [key: string]
}>()

/** A record's own column reads from the record; everything else from its data. */
function cellValue(record: IRecord, column: IField): TRecordValue {
  return RECORD_COLUMNS[column.key]?.value(record) ?? record.data[column.key] ?? null
}

function cellComponent(column: IField) {
  return RECORD_COLUMNS[column.key]?.cell ?? FIELD_CELLS[column.type]
}

function isBlank(value: TRecordValue | undefined): boolean {
  return value === null || value === undefined
}

function ariaSort(field: IField): 'ascending' | 'descending' | 'none' {
  if (props.sort?.key !== field.key) return 'none'
  return props.sort.dir === 'asc' ? 'ascending' : 'descending'
}

function sortIcon(field: IField): string {
  if (props.sort?.key !== field.key) return 'mdi:unfold-more-horizontal'
  return props.sort.dir === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'
}
</script>

<style lang="scss" scoped>
.dynamic-table {
  overflow-x: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);

  &__table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--font-size-sm);
  }

  th,
  td {
    border-bottom: 1px solid var(--color-border);
    text-align: left;
    // Load-bearing: `&__number-head` / `&__actions-head` shrink to fit via `width: rem(1)`
    white-space: nowrap;
  }

  // An explicit height, so no single cell defines the row — before this the action cell's
  // buttons did, which is why a 44px button would otherwise push rows to 64px
  tbody td {
    height: rem(52);
    padding: rem(6) rem(16);
    vertical-align: middle;
  }

  th {
    // Padding moves onto the sort button so the whole header cell is the target
    padding: 0;
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  &__sort {
    display: flex;
    align-items: center;
    gap: rem(4);
    width: 100%;
    min-height: var(--control-height);
    padding: rem(10) rem(16);
    border: none;
    font: inherit;
    color: inherit;
    background: none;
    text-align: left;
    cursor: pointer;

    &:hover,
    &:focus-visible {
      color: var(--color-accent);
    }

    // Keyboard focus reveals the affordance too — on hover alone it is invisible
    // to anyone who is not using a pointer
    &:hover .dynamic-table__sort-icon,
    &:focus-visible .dynamic-table__sort-icon {
      opacity: 1;
    }
  }

  &__sort-icon {
    opacity: 0;
    transition: opacity 0.15s ease;

    &--active {
      opacity: 1;
      color: var(--color-accent);
    }
  }

  tbody tr:last-child {
    th,
    td {
      border-bottom: none;
    }
  }

  tbody tr:hover {
    background: var(--color-surface-hover);
  }

  // A text role, not a border one — the border token here was ~1.5:1
  &__blank {
    color: var(--color-text-subtle);
  }

  &__number-head,
  &__actions-head {
    width: rem(1);
  }

  // `display: flex` takes this cell out of table layout, so it needs to centre its own
  // content and give the 44px buttons room inside the 52px row
  &__actions {
    display: flex;
    align-items: center;
    gap: rem(4);
    padding-block: rem(4);
  }
}
</style>
