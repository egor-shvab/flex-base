<template>
  <div class="dynamic-table">
    <table class="dynamic-table__table">
      <thead>
        <tr>
          <th v-for="field in fields" :key="field.key" scope="col">{{ field.name }}</th>
          <th scope="col" class="dynamic-table__actions-head">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="record in records" :key="record.id">
          <td v-for="field in fields" :key="field.key">
            <!-- Blank values are rendered here so no cell component has to handle null -->
            <span v-if="isBlank(record.data[field.key])" class="dynamic-table__blank">—</span>
            <component
              :is="FIELD_COMPONENTS[field.type].cell"
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
import type { IRecord, TRecordValue } from '#shared/types/record'
import { FIELD_COMPONENTS } from '~/components/fields/registry'

defineProps<{
  fields: IField[]
  records: IRecord[]
}>()

const emit = defineEmits<{ edit: [record: IRecord]; delete: [record: IRecord] }>()

function isBlank(value: TRecordValue | undefined): boolean {
  return value === null || value === undefined
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
