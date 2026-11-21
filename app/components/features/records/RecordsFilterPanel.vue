<template>
  <BaseModal title="Filters" variant="drawer" @close="emit('close')">
    <div class="filter-panel">
      <!-- Below compact the table shows one column's header, so its sort moves here -->
      <div class="filter-panel__sort">
        <BaseSelect
          :id="`${panelId}-sort-key`"
          label="Sort by"
          :options="sortOptions"
          :model-value="sort.key"
          @update:model-value="emit('update:sort', { ...sort, key: $event })"
        />
        <BaseSegmented
          :id="`${panelId}-sort-direction`"
          label="Order"
          :options="SORT_DIRECTION_OPTIONS"
          :model-value="sort.direction"
          @update:model-value="applySortDirection"
        />
      </div>
      <p class="g-note filter-panel__intro">
        Each field filters on its own. A record has to match every filter to show.
      </p>
      <component
        :is="control.component"
        v-for="control in controls"
        :id="`${panelId}-${control.field.key}`"
        :key="control.field.key"
        v-bind="control.props"
        :model-value="controlValue(control)"
        @update:model-value="applyFieldValue(control.field, filterValue(control, $event))"
      />
    </div>

    <template #footer>
      <div class="filter-panel__footer">
        <BaseButton
          v-if="activeFilterCount > 0"
          variant="secondary"
          @click="emit('update:filters', {})"
        >
          Clear all
        </BaseButton>
        <span class="g-note filter-panel__count">
          {{ isFilteringShown ? 'Filtering…' : formatMatchingRecords(total, totalCapped) }}
        </span>
        <BaseButton @click="emit('close')">Done</BaseButton>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
import {
  buildQueryColumns,
  emptyFilterValueFor,
  toFilterableColumns,
  buildFiltersWithValue,
} from '#shared/utils/filter'
import type { IField } from '#shared/types/field'
import type {
  IRecordSort,
  TFilterValue,
  TRecordFilterValues,
  TSortDirection,
} from '#shared/types/filter'
import type { ISelectOption } from '~/types/select'
import { useDelayedFlag } from '~/composables/useDelayedFlag'
import { useFieldControls } from '~/composables/useFieldControls'
import { filterFor } from '~/field-types/registry'
import { formatMatchingRecords } from '~/utils/format'

const props = defineProps<{
  fields: IField[]
  filters: TRecordFilterValues
  sort: IRecordSort
  total: number
  totalCapped: boolean
  pending?: boolean
}>()

const emit = defineEmits<{
  'update:filters': [filters: TRecordFilterValues]
  'update:sort': [sort: IRecordSort]
  close: []
}>()

/** A fast filter keeps its count rather than blinking "Filtering…". */
const isFilteringShown = useDelayedFlag(() => props.pending)

const panelId = useId()

const SORT_DIRECTION_OPTIONS: ISelectOption<TSortDirection>[] = [
  { value: 'asc', label: 'Ascending' },
  { value: 'desc', label: 'Descending' },
]

const sortOptions = computed<ISelectOption[]>(() =>
  buildQueryColumns(props.fields).map((column) => ({ value: column.key, label: column.name })),
)

function applySortDirection(direction: string | undefined) {
  const match = SORT_DIRECTION_OPTIONS.find((option) => option.value === direction)
  if (match) emit('update:sort', { ...props.sort, direction: match.value })
}

const activeFilterCount = computed(() => Object.keys(props.filters).length)

const columns = computed(() => toFilterableColumns(props.fields))

const controls = useFieldControls(() => columns.value, filterFor)

type TFilterControl = (typeof controls.value)[number]

function valueFor(field: IField): TFilterValue {
  return props.filters[field.key] ?? emptyFilterValueFor(field)
}

function controlValue(control: TFilterControl): TFilterValue {
  const value = valueFor(control.field)

  return control.toControl ? control.toControl(value) : value
}

function filterValue(control: TFilterControl, model: TFilterValue): TFilterValue {
  return control.fromControl ? control.fromControl(model) : model
}

function applyFieldValue(changed: IField, value: TFilterValue) {
  emit('update:filters', buildFiltersWithValue(columns.value, props.filters, changed.key, value))
}
</script>

<style lang="scss" scoped>
.filter-panel {
  @include stack;

  &__sort {
    display: none;

    @include below-compact {
      @include stack;

      padding-bottom: rem(16);
      border-bottom: 1px solid var(--color-border);
    }
  }

  &__footer {
    display: flex;
    flex: 1;
    align-items: center;
    gap: rem(8);
  }

  &__count {
    flex: 1;
    min-width: 0;
  }
}
</style>
