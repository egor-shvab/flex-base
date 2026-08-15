<template>
  <BaseModal title="Filters" variant="drawer" @close="emit('close')">
    <div class="filter-panel">
      <component
        :is="control.component"
        v-for="control in controls"
        :id="`${panelId}-${control.field.key}`"
        :key="control.field.key"
        v-bind="control.props"
        :model-value="controlValue(control.field)"
        @update:model-value="applyFieldValue(control.field, filterValue(control.field, $event))"
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
          prepend-icon="mdi:filter-remove-outline"
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
import {
  emptyFilterValueFor,
  filterableFields,
  isFilterValueEmpty,
  queryFields,
} from '#shared/utils/filter'
import type { IField } from '#shared/types/field'
import type { TFilterValue, TRecordFilterValues } from '#shared/types/filter'
import { filterFor } from '~/field-types/filters'

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

/**
 * The record's own columns filter alongside the table's fields (see `queryFields`), minus any
 * column whose filter could not round-trip through the URL — a control that discards what is
 * typed into it is a dead control (`CLAUDE.md` §7).
 */
const columns = computed(() => filterableFields(queryFields(props.fields)))

/** Resolved once per field rather than per render, since `props` is a factory. */
const controls = computed(() =>
  columns.value.map((field) => {
    const filter = filterFor(field)

    return { field, component: filter.component, props: filter.props(field) }
  }),
)

/** Every control is always rendered, so an unfiltered field shows its own empty value. */
function valueFor(field: IField): TFilterValue {
  return props.filters[field.key] ?? emptyFilterValueFor(field)
}

/** The field's filter value as the control's own model. */
function controlValue(field: IField): TFilterValue {
  const { toControl } = filterFor(field)
  const value = valueFor(field)

  return toControl ? toControl(value) : value
}

/** The inverse: what the control just emitted, back as a filter value. */
function filterValue(field: IField, model: TFilterValue): TFilterValue {
  const { fromControl } = filterFor(field)

  return fromControl ? fromControl(model) : model
}

/**
 * Replaces one field's value, rebuilding the map in field order so the URL stays stable no
 * matter which control the user touched. A value that means "not filtered" is dropped, so
 * the map only ever holds active filters.
 */
function applyFieldValue(changed: IField, value: TFilterValue) {
  const next: TRecordFilterValues = {}

  for (const field of columns.value) {
    const candidate = field.key === changed.key ? value : props.filters[field.key]
    if (candidate !== undefined && !isFilterValueEmpty(candidate)) next[field.key] = candidate
  }

  emit('update:filters', next)
}
</script>

<style lang="scss" scoped>
.filter-panel {
  @include stack;

  // Placement only — BaseModal's drawer variant owns the footer's chrome
  &__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: rem(12);
  }

  &__count {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }
}
</style>
