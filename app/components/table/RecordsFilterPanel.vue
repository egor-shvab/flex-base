<template>
  <BaseModal title="Filters" variant="drawer" @close="emit('close')">
    <div class="filter-panel">
      <component
        :is="FIELD_COMPONENTS[field.type].filter"
        v-for="field in fields"
        :id="`${panelId}-${field.key}`"
        :key="field.key"
        :field="field"
        :conditions="conditionsFor(field)"
        @update:conditions="applyFieldConditions(field, $event)"
      />
    </div>

    <template #footer>
      <div class="filter-panel__footer">
        <span class="filter-panel__count">
          {{ pending ? 'Filtering…' : `${total} matching ${total === 1 ? 'record' : 'records'}` }}
        </span>
        <BaseButton
          v-if="filters.length > 0"
          variant="ghost"
          icon="mdi:filter-remove-outline"
          @click="emit('update:filters', [])"
        >
          Clear all
        </BaseButton>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { useId } from 'vue'
import { FIELD_COMPONENTS } from '~/components/fields/registry'
import type { IField } from '#shared/types/field'
import type { IRecordFilter } from '#shared/types/filter'

const props = defineProps<{
  fields: IField[]
  filters: IRecordFilter[]
  total: number
  pending?: boolean
}>()

const emit = defineEmits<{
  'update:filters': [filters: IRecordFilter[]]
  close: []
}>()

const panelId = useId()

function conditionsFor(field: IField): IRecordFilter[] {
  return props.filters.filter((filter) => filter.key === field.key)
}

/**
 * Replaces one field's slice of the conditions, rebuilding the list in field order so the
 * URL stays stable no matter which control the user touched.
 */
function applyFieldConditions(changed: IField, conditions: IRecordFilter[]) {
  const next = props.fields.flatMap((field) =>
    field.key === changed.key ? conditions : conditionsFor(field),
  )
  emit('update:filters', next)
}
</script>

<style lang="scss" scoped>
.filter-panel {
  display: flex;
  flex-direction: column;
  gap: rem(16);

  // Placement only — BaseModal's drawer variant owns the footer's chrome
  &__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: rem(12);
  }

  &__count {
    font-size: rem(13);
    color: var(--color-text-muted);
  }
}
</style>
