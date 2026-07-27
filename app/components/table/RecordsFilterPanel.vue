<template>
  <BaseModal title="Filters" variant="drawer" @close="emit('close')">
    <div class="filter-panel">
      <component
        :is="FIELD_COMPONENTS[field.type].filter"
        v-for="field in fields"
        :id="`${panelId}-${field.key}`"
        :key="field.key"
        :field="field"
        :model-value="valueFor(field)"
        @update:model-value="applyFieldValue(field, $event)"
      />
    </div>

    <template #footer>
      <div class="filter-panel__footer">
        <span class="filter-panel__count">
          {{ pending ? 'Filtering…' : `${total} matching ${total === 1 ? 'record' : 'records'}` }}
        </span>
        <BaseButton
          v-if="activeFilterCount > 0"
          variant="ghost"
          icon="mdi:filter-remove-outline"
          @click="emit('update:filters', {})"
        >
          Clear all
        </BaseButton>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
import { FIELD_COMPONENTS } from '~/components/fields/registry'
import { FILTER_VALUE_BY_TYPE } from '#shared/constants/filter'
import type { IField } from '#shared/types/field'
import type { TFilterValue, TRecordFilterValues } from '#shared/types/filter'
import { isFilterValueEmpty } from '#shared/utils/filter'

const props = defineProps<{
  fields: IField[]
  filters: TRecordFilterValues
  total: number
  pending?: boolean
}>()

const emit = defineEmits<{
  'update:filters': [filters: TRecordFilterValues]
  close: []
}>()

const panelId = useId()

const activeFilterCount = computed(() => Object.keys(props.filters).length)

/** Every control is always rendered, so an unfiltered field shows its type's empty value. */
function valueFor(field: IField): TFilterValue {
  return props.filters[field.key] ?? FILTER_VALUE_BY_TYPE[field.type].empty
}

/**
 * Replaces one field's value, rebuilding the map in field order so the URL stays stable no
 * matter which control the user touched. A value that means "not filtered" is dropped, so
 * the map only ever holds active filters.
 */
function applyFieldValue(changed: IField, value: TFilterValue) {
  const next: TRecordFilterValues = {}

  for (const field of props.fields) {
    const candidate = field.key === changed.key ? value : props.filters[field.key]
    if (candidate !== undefined && !isFilterValueEmpty(candidate)) next[field.key] = candidate
  }

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
