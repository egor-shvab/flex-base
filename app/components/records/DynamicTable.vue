<template>
  <div class="dynamic-table">
    <table class="dynamic-table__table">
      <thead>
        <tr>
          <th v-for="field in fields" :key="field.key" scope="col" :aria-sort="ariaSort(field)">
            <button type="button" class="dynamic-table__sort" @click="emit('sort', field.key)">
              {{ field.name }}
              <Icon
                :name="sortIcon(field)"
                class="dynamic-table__sort-icon"
                :class="{ 'dynamic-table__sort-icon--active': sort?.key === field.key }"
                aria-hidden="true"
              />
            </button>
          </th>
          <th scope="col" class="dynamic-table__actions-head">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="record in records" :key="record.id">
          <td v-for="field in fields" :key="field.key">
            <!-- Blank values are rendered here so no cell component has to handle null -->
            <span v-if="isBlank(record.data[field.key])" class="dynamic-table__blank">—</span>
            <component
              :is="FIELD_CELLS[field.type]"
              v-else
              :field="field"
              :value="record.data[field.key]"
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
              hover-color="var(--color-danger)"
              @click="emit('delete', record)"
            />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import type { IField } from '#shared/types/field'
import type { IRecordSort } from '#shared/types/filter'
import type { IRecord, TRecordValue } from '#shared/types/record'
import { FIELD_CELLS } from '~/field-types/cells'

const props = defineProps<{
  fields: IField[]
  records: IRecord[]
  sort?: IRecordSort | null
}>()

const emit = defineEmits<{
  edit: [record: IRecord]
  delete: [record: IRecord]
  sort: [key: string]
}>()

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
  border-radius: rem(8);
  background: var(--color-surface);

  &__table {
    width: 100%;
    border-collapse: collapse;
    font-size: rem(14);
  }

  th,
  td {
    padding: rem(10) rem(16);
    border-bottom: 1px solid var(--color-border);
    text-align: left;
    white-space: nowrap;
  }

  th {
    font-size: rem(13);
    font-weight: 600;
    color: var(--color-text-muted);
  }

  &__sort {
    display: inline-flex;
    align-items: center;
    gap: rem(4);
    padding: 0;
    border: none;
    font: inherit;
    color: inherit;
    background: none;
    cursor: pointer;

    &:hover {
      color: var(--color-primary);
    }

    &:hover .dynamic-table__sort-icon {
      opacity: 1;
    }
  }

  &__sort-icon {
    opacity: 0;
    transition: opacity 0.15s ease;

    &--active {
      opacity: 1;
      color: var(--color-primary);
    }
  }

  tbody tr:last-child {
    th,
    td {
      border-bottom: none;
    }
  }

  tbody tr:hover {
    background: var(--color-bg);
  }

  &__blank {
    color: var(--color-border);
  }

  &__actions-head {
    width: rem(1);
  }

  &__actions {
    display: flex;
    gap: rem(4);
  }
}
</style>
